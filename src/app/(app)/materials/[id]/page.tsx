// src/app/(app)/materials/[id]/page.tsx
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  updateMaterial,
  setMaterialStockQty,
  softDeleteMaterial,
  restoreMaterial,
} from "@/lib/actions";
import { PERM } from "@/lib/permissions";
import BackButton from "@/components/BackButton";
import { fetchInventoryLocations } from "@/lib/queries/inventoryLocations";

import TransferMaterialModalClient from "@/app/(app)/materials/[id]/_components/TransferMaterialModalClient";
import ConfirmSaveClient from "@/app/(app)/materials/[id]/_components/ConfirmSaveClient";
import ConfirmDangerClient from "@/app/(app)/materials/[id]/_components/ConfirmDangerClient";
import MaterialImageUploaderClient from "@/app/(app)/materials/[id]/_components/MaterialImageUploaderClient";

/* =========================    Permissions snapshot ========================= */

type SnapshotA = {
  role?: string | null;
  permissions?: string[];
  account_id?: string | null;
  current_account_id?: string | null;
};
type SnapshotRow = { key: string; allowed: boolean };
type Snapshot = {
  role: string | null;
  permSet: Set<string>;
  account_id?: string | null;
  current_account_id?: string | null;
};

async function getSnapshot(): Promise<Snapshot> {
  const sb = await supabaseServer();
  const { data } = await sb.rpc("my_permissions_snapshot");

  const out: Snapshot = { role: null, permSet: new Set<string>() };
  if (!data) return out;

  const obj = Array.isArray(data) ? (data[0] ?? null) : data;
  if (obj && typeof obj === "object") {
    const a = obj as SnapshotA;
    if (Array.isArray(a.permissions)) out.permSet = new Set(a.permissions.map((x) => String(x)));
    if (typeof a.role === "string") out.role = a.role;
    if (typeof a.account_id === "string") out.account_id = a.account_id;
    if (typeof a.current_account_id === "string") out.current_account_id = a.current_account_id;

    if (out.permSet.size > 0 || out.role) return out;
  }

  if (Array.isArray(data)) {
    const rows = data as any as SnapshotRow[];
    out.permSet = new Set(
      rows
        .filter((r) => r?.allowed)
        .map((r) => String(r.key))
        .filter(Boolean)
    );
    return out;
  }

  return out;
}

const has = (s: Set<string>, key: string) => s.has(key);

function isReadOnlyRole(role: string | null) {
  const r = (role ?? "").toLowerCase();
  return r === "worker" || r === "foreman";
}

/* =========================    Helpers ========================= */

const UNIT_OPTIONS = [
  { value: "szt", label: "Sztuka (szt)" },
  { value: "paczka", label: "Paczka (paczka)" },
  { value: "opak", label: "Opakowanie (opak)" },
  { value: "kg", label: "Kilogram (kg)" },
  { value: "l", label: "Litr (l)" },
  { value: "m", label: "Metr (m)" },
  { value: "m2", label: "Metr kwadratowy (m²)" },
  { value: "m3", label: "Metr sześcienny (m³)" },
] as const;

function safeExt(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "bin";
  const clean = ext.replace(/[^a-z0-9]/g, "") || "bin";
  return clean.slice(0, 10);
}

function fmtWhen(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pl-PL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toNum(v: unknown) {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") return Number(v) || 0;
  return 0;
}

function pctOfBase(currentQty: number, baseQty: number) {
  if (!Number.isFinite(currentQty) || !Number.isFinite(baseQty) || baseQty <= 0) return 0;
  return Math.round((currentQty / baseQty) * 100);
}

/* =========================    Server Actions (GATED) ========================= */

async function saveMaterial(formData: FormData) {
  "use server";

  const snap = await getSnapshot();
  if (!has(snap.permSet, PERM.MATERIALS_WRITE)) return;
  if (isReadOnlyRole(snap.role)) return;

  const id = String(formData.get("id") || "");
  if (!id) return;

  const patch: Record<string, unknown> = {};

  for (const key of ["title", "description", "unit"] as const) {
    if (!formData.has(key)) continue;
    const v = formData.get(key);
    const str = v == null ? "" : String(v).trim();
    if (str === "") {
      if (key === "description") patch[key] = null;
      continue;
    }
    patch[key] = str;
  }

  for (const key of ["base_quantity"] as const) {
    if (!formData.has(key)) continue;
    const v = Number(formData.get(key));
    patch[key] = Number.isFinite(v) ? v : 0;
  }

  if (formData.has("current_quantity")) {
    const v = Number(formData.get("current_quantity"));
    const newQty = Number.isFinite(v) ? v : 0;
    await setMaterialStockQty(id, newQty, "Zmiana stanu z karty materiału");
  }

  await updateMaterial(id, patch);

  const p = new URLSearchParams();
  p.set("toast", encodeURIComponent("Zmiany zostały zapisane."));
  p.set("tone", "ok");
  redirect(`/materials/${id}?${p.toString()}`);
}

async function uploadMaterialImage(formData: FormData) {
  "use server";

  const snap = await getSnapshot();
  if (!has(snap.permSet, PERM.MATERIALS_WRITE)) return;
  if (isReadOnlyRole(snap.role)) return;

  const id = String(formData.get("id") || "");
  if (!id) return;

  const file = formData.get("image");
  if (!(file instanceof File) || !file.size) {
    const p = new URLSearchParams();
    p.set("toast", encodeURIComponent("Wybierz zdjęcie (JPG/PNG/WEBP)."));
    p.set("tone", "err");
    redirect(`/materials/${id}?${p.toString()}`);
  }

  const sb = await supabaseServer();
  const BUCKET = "material-images";

  let accountId: string | null =
    (snap as any)?.account_id || (snap as any)?.current_account_id || null;

  if (!accountId) {
    const { data: acc } = await sb.rpc("current_account_id");
    if (typeof acc === "string" && acc.length > 20) accountId = acc;
  }

  if (!accountId) {
    console.error("uploadMaterialImage: missing accountId");
    const p = new URLSearchParams();
    p.set("toast", encodeURIComponent("Brak account_id — nie można zapisać zdjęcia."));
    p.set("tone", "err");
    redirect(`/materials/${id}?${p.toString()}`);
  }

  const ext = safeExt((file as File).name);
  const fileName = `${Date.now()}.${ext}`;
  const path = `${accountId}/materials/${id}/${fileName}`;

  const { error: upErr } = await sb.storage.from(BUCKET).upload(path, file as File, {
    upsert: true,
    contentType: (file as File).type || "application/octet-stream",
  });

  if (upErr) {
    console.error("uploadMaterialImage upload error:", upErr);
    const p = new URLSearchParams();
    p.set("toast", encodeURIComponent("Nie udało się wgrać zdjęcia."));
    p.set("tone", "err");
    redirect(`/materials/${id}?${p.toString()}`);
  }

  const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = pub?.publicUrl;

  if (publicUrl) {
    await updateMaterial(id, { image_url: publicUrl });
    const p = new URLSearchParams();
    p.set("toast", encodeURIComponent("Zdjęcie zostało zapisane."));
    p.set("tone", "ok");
    redirect(`/materials/${id}?${p.toString()}`);
  }

  await updateMaterial(id, { image_url: null });
  console.warn("material-images bucket is not public; consider signed URLs");
  const p = new URLSearchParams();
  p.set("toast", encodeURIComponent("Bucket zdjęć nie jest publiczny — ustaw public lub signed URL."));
  p.set("tone", "err");
  redirect(`/materials/${id}?${p.toString()}`);
}

async function removeMaterialImage(formData: FormData) {
  "use server";

  const snap = await getSnapshot();
  if (!has(snap.permSet, PERM.MATERIALS_WRITE)) return;
  if (isReadOnlyRole(snap.role)) return;

  const id = String(formData.get("id") || "");
  if (!id) return;

  await updateMaterial(id, { image_url: null });

  const p = new URLSearchParams();
  p.set("toast", encodeURIComponent("Zdjęcie zostało usunięte."));
  p.set("tone", "ok");
  redirect(`/materials/${id}?${p.toString()}`);
}

async function doDelete(formData: FormData) {
  "use server";
  const snap = await getSnapshot();
  if (!has(snap.permSet, PERM.MATERIALS_SOFT_DELETE)) return;
  if (isReadOnlyRole(snap.role)) return;

  const id = String(formData.get("id") || "");
  if (!id) return;

  await softDeleteMaterial(id);

  const p = new URLSearchParams();
  p.set("toast", encodeURIComponent("Materiał został usunięty."));
  p.set("tone", "ok");
  redirect(`/materials/${id}?${p.toString()}`);
}

async function doRestore(formData: FormData) {
  "use server";
  const snap = await getSnapshot();
  if (!has(snap.permSet, PERM.MATERIALS_SOFT_DELETE)) return;
  if (isReadOnlyRole(snap.role)) return;

  const id = String(formData.get("id") || "");
  if (!id) return;

  await restoreMaterial(id);

  const p = new URLSearchParams();
  p.set("toast", encodeURIComponent("Materiał został przywrócony."));
  p.set("tone", "ok");
  redirect(`/materials/${id}?${p.toString()}`);
}

async function transferFromMaterialCard(formData: FormData) {
  "use server";

  const snap = await getSnapshot();
  if (!has(snap.permSet, PERM.MATERIALS_WRITE)) return;
  if (isReadOnlyRole(snap.role)) return;

  const from_material_id = String(formData.get("from_material_id") || "").trim();
  const to_location_id = String(formData.get("to_location_id") || "").trim();
  const qty = Number(formData.get("qty"));

  if (!from_material_id || !to_location_id || !Number.isFinite(qty) || qty <= 0) {
    const p = new URLSearchParams();
    p.set("toast", encodeURIComponent("Nieprawidłowe dane transferu."));
    p.set("tone", "err");
    redirect(`/materials/${from_material_id}?${p.toString()}`);
  }

  const sb = await supabaseServer();

  const { data: fromRow } = await sb
    .from("materials")
    .select("id,inventory_location_label,unit")
    .eq("id", from_material_id)
    .maybeSingle();

  const { data: toLoc } = await sb
    .from("inventory_locations")
    .select("id,label")
    .eq("id", to_location_id)
    .maybeSingle();

  const fromLabel = (fromRow as any)?.inventory_location_label ?? "—";
  const toLabel = (toLoc as any)?.label ?? "—";
  const unit = (fromRow as any)?.unit ?? "";

  const clientKey = `matcard-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const { error } = await sb.rpc("create_inventory_relocation", {
    p_from_material_id: from_material_id,
    p_to_location_id: to_location_id,
    p_qty: qty,
    p_note: "Transfer z karty materiału",
    p_client_key: clientKey,
  });

  const p = new URLSearchParams();
  if (error) {
    p.set("toast", encodeURIComponent("Nie udało się wykonać transferu."));
    p.set("tone", "err");
    redirect(`/materials/${from_material_id}?${p.toString()}`);
  }

  p.set(
    "toast",
    encodeURIComponent(`Przeniesiono ${qty} ${unit} z „${fromLabel}” do „${toLabel}”.`)
  );
  p.set("tone", "ok");
  redirect(`/materials/${from_material_id}?${p.toString()}`);
}

/* =========================    Page ========================= */

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

type MaterialRowBase = {
  id: string;
  title: string;
  description: string | null;
  unit: string | null;
  base_quantity: number;
  current_quantity: number;
  image_url: string | null;
  created_at: string | null;
  deleted_at: string | null;

  inventory_location_id: string | null;
  inventory_location_label: string | null;
};

type MaterialRowWithDeletedBy = MaterialRowBase & {
  deleted_by?: string | null;
};

type TeamMemberMini = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

async function fetchMaterialWithOptionalDeletedBy(
  sb: Awaited<ReturnType<typeof supabaseServer>>,
  id: string
) {
  const try1 = await sb
    .from("materials")
    .select(
      "id,title,description,unit,base_quantity,current_quantity,image_url,created_at,deleted_at,deleted_by,inventory_location_id,inventory_location_label"
    )
    .eq("id", id)
    .maybeSingle();

  if (!try1.error) {
    return {
      row: (try1.data as unknown as MaterialRowWithDeletedBy) ?? null,
      hasDeletedByColumn: true,
    };
  }

  const msg = String(try1.error.message || "");
  const missingColumn =
    msg.toLowerCase().includes("column") && msg.toLowerCase().includes("deleted_by");
  if (!missingColumn) console.error("materials select (with deleted_by) error:", try1.error);

  const try2 = await sb
    .from("materials")
    .select(
      "id,title,description,unit,base_quantity,current_quantity,image_url,created_at,deleted_at,inventory_location_id,inventory_location_label"
    )
    .eq("id", id)
    .maybeSingle();

  if (try2.error) {
    console.error("materials select error:", try2.error);
    return { row: null as MaterialRowWithDeletedBy | null, hasDeletedByColumn: false };
  }

  return {
    row: (try2.data as unknown as MaterialRowWithDeletedBy) ?? null,
    hasDeletedByColumn: false,
  };
}

async function fetchDeletedByMember(
  sb: Awaited<ReturnType<typeof supabaseServer>>,
  deletedBy: string | null | undefined
): Promise<TeamMemberMini | null> {
  if (!deletedBy) return null;

  const a = await sb
    .from("team_members")
    .select("id,first_name,last_name,email")
    .eq("id", deletedBy)
    .maybeSingle();
  if (a.data && !a.error) return a.data as TeamMemberMini;

  const b = await sb
    .from("team_members")
    .select("id,first_name,last_name,email")
    .eq("user_id", deletedBy)
    .maybeSingle();
  if (b.data && !b.error) return b.data as TeamMemberMini;

  return null;
}

async function fetchSameTitleRows(sb: Awaited<ReturnType<typeof supabaseServer>>, title: string) {
  const { data, error } = await sb
    .from("materials")
    .select("id,inventory_location_id,inventory_location_label,current_quantity")
    .eq("title", title)
    .is("deleted_at", null);

  if (error) return [];
  return Array.isArray(data) ? data : [];
}

export default async function MaterialDetailsPage({ params }: PageProps) {
  const { id } = await params;

  const snap = await getSnapshot();
  if (!has(snap.permSet, PERM.MATERIALS_READ)) redirect("/");

  const canWrite = has(snap.permSet, PERM.MATERIALS_WRITE) && !isReadOnlyRole(snap.role);
  const canSoftDelete = has(snap.permSet, PERM.MATERIALS_SOFT_DELETE) && !isReadOnlyRole(snap.role);

  const sb = await supabaseServer();
  const { row: m } = await fetchMaterialWithOptionalDeletedBy(sb, id);

  if (!m) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-end">
          <BackButton className="card inline-flex items-center px-3 py-2 text-xs font-medium" />
        </div>
        <p className="text-sm opacity-70">Materiał nie istnieje albo nie masz do niego dostępu.</p>
      </div>
    );
  }

  const pct = pctOfBase(toNum(m.current_quantity), toNum(m.base_quantity));

  const deletedByMember = m.deleted_at
    ? await fetchDeletedByMember(sb, (m as MaterialRowWithDeletedBy).deleted_by)
    : null;

  const locations = await fetchInventoryLocations({ includeDeleted: false });
  const sameTitleRows = await fetchSameTitleRows(sb, m.title);

  const BTN_NEUTRAL =
    "w-full px-3 py-2 rounded-md border border-border bg-card hover:bg-card/80 transition text-xs font-medium";
  const BTN_RED =
    "w-full px-3 py-2 rounded-md border border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/15 transition text-xs font-medium";
  const BTN_GREEN =
    "w-full px-3 py-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/15 transition text-xs font-medium";

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-2xl font-semibold truncate">{m.title}</div>

          <div className="mt-1 text-sm opacity-70">
            Lokacja: <b className="opacity-90">{m.inventory_location_label ?? "—"}</b>
            {m.deleted_at ? <span className="ml-2 text-red-300">• usunięty</span> : null}
          </div>

          <div className="mt-1 text-xs opacity-60">
            Utworzono: <span className="opacity-80">{fmtWhen(m.created_at)}</span>
          </div>
        </div>

        <BackButton className="card inline-flex items-center px-3 py-2 text-xs font-medium" />
      </div>

      {/* deleted info */}
      {m.deleted_at ? (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="text-sm font-medium text-red-200">Materiał jest usunięty</div>
          <div className="mt-2 text-xs opacity-75">
            <span className="opacity-80">Usunięto:</span> {fmtWhen(m.deleted_at)}
            {deletedByMember ? (
              <>
                {" "}
                <span className="opacity-50">·</span> <span className="opacity-80">przez:</span>{" "}
                {deletedByMember.first_name || deletedByMember.last_name ? (
                  <span>
                    {deletedByMember.first_name ?? ""} {deletedByMember.last_name ?? ""}
                  </span>
                ) : (
                  <span>{deletedByMember.email ?? "nieznany"}</span>
                )}
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[380px_1fr] items-start">
        {/* left column */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <div className="aspect-square rounded-xl bg-background/40 border border-border/60 overflow-hidden flex items-center justify-center text-xs opacity-60">
              {m.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.image_url} className="w-full h-full object-cover" alt="" />
              ) : (
                "brak miniatury"
              )}
            </div>

            {/* image: uploader OR remove */}
            {canWrite ? (
              m.image_url ? (
                <div className="rounded-xl border border-border bg-background/20 p-3 space-y-2">
                  {/* ✅ notka: usuń aby zmienić */}
                  <div className="text-[11px] text-foreground/60">
                    Aby zmienić zdjęcie, najpierw kliknij <b>Usuń zdjęcie</b>.
                  </div>

                  <form action={removeMaterialImage}>
                    <input type="hidden" name="id" value={m.id} />
                    <button className="w-full rounded-full border border-red-500/40 bg-red-500/10 text-red-200 px-5 py-2 text-[11px] font-semibold hover:bg-red-500/15 transition">
                      Usuń zdjęcie
                    </button>
                  </form>
                </div>
              ) : (
                // ✅ NOWY uploader z preview/usuń (jak na screenach)
                <div className="rounded-xl border border-border bg-background/20 p-3">
                  <MaterialImageUploaderClient
                    materialId={m.id}
                    disabled={!canWrite}
                    action={uploadMaterialImage}
                  />
                </div>
              )
            ) : null}
          </div>
        </div>

        {/* right column */}
        <div className="space-y-4">
          {/* ✅ TYLKO TEN FORM: zapis pól */}
          <form
            id="materialSaveForm"
            action={saveMaterial}
            className="rounded-2xl border border-border bg-card p-4 space-y-4"
          >
            <input type="hidden" name="id" value={m.id} />

            <div className="grid gap-2">
              <label className="text-sm opacity-80">Nazwa</label>
              <input
                name="title"
                defaultValue={m.title}
                disabled={!canWrite}
                className="w-full border border-border rounded-md px-3 py-2 bg-background disabled:opacity-60 hover:bg-foreground/5 transition"
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm opacity-80">Lokacja</label>
              <div className="text-sm border border-border rounded-md px-3 py-2 bg-background/40">
                {m.inventory_location_label ?? "—"}
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-sm opacity-80">Opis</label>
              <textarea
                name="description"
                defaultValue={m.description ?? ""}
                disabled={!canWrite}
                className="w-full border border-border rounded-md px-3 py-2 bg-background disabled:opacity-60 hover:bg-foreground/5 transition"
                rows={3}
              />
            </div>

            {/* Stan/Baza/Miara — mobile: 2 kolumny + miara pod spodem */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="grid gap-2 min-w-0">
                <label className="text-sm opacity-80">Stan</label>
                <input
                  name="current_quantity"
                  type="number"
                  step="1"
                  inputMode="numeric"
                  defaultValue={Math.trunc(toNum(m.current_quantity))}
                  disabled={!canWrite}
                  className="w-full min-w-0 border border-border rounded-md px-2.5 py-2 bg-background disabled:opacity-60 hover:bg-foreground/5 transition"
                />
              </div>

              <div className="grid gap-2 min-w-0">
                <label className="text-sm opacity-80">Baza</label>
                <input
                  name="base_quantity"
                  type="number"
                  step="1"
                  inputMode="numeric"
                  defaultValue={Math.trunc(toNum(m.base_quantity))}
                  disabled={!canWrite}
                  className="w-full min-w-0 border border-border rounded-md px-2.5 py-2 bg-background disabled:opacity-60 hover:bg-foreground/5 transition"
                />
              </div>

              <div className="grid gap-2 min-w-0 col-span-2 sm:col-span-1">
                <label className="text-sm opacity-80">Miara</label>
                <select
                  name="unit"
                  defaultValue={m.unit ?? "szt"}
                  disabled={!canWrite}
                  className="w-full min-w-0 border border-border rounded-md px-2.5 py-2 bg-background disabled:opacity-60 hover:bg-foreground/5 transition"
                >
                  {UNIT_OPTIONS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* pasek */}
            <div className="rounded-xl border border-border bg-background/20 p-3">
              <div className="text-xs opacity-70">Stan</div>
              <div className="mt-1 text-sm font-semibold">
                {m.current_quantity} / {m.base_quantity} {m.unit}
              </div>
              <div className="mt-2 h-2 rounded bg-background/60 overflow-hidden">
                <div
                  className={`h-full ${pct <= 25 ? "bg-red-500/70" : "bg-foreground/70"}`}
                  style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
                />
              </div>
              <div className="mt-2 text-[11px] opacity-70">{pct}% bazy</div>
            </div>
          </form>

          {/* ✅ AKCJE POZA FORMEM ZAPISU */}
          <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
            <div className="text-sm font-medium">Akcje</div>

            {/* mobile: 2 kolumny (Usuń/Transfer) + Save full-width pod spodem */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 items-center">
              {/* Usuń / Przywróć */}
              {canSoftDelete ? (
                m.deleted_at ? (
                  <form action={doRestore} className="w-full">
                    <input type="hidden" name="id" value={m.id} />
                    <button className={BTN_GREEN}>Przywróć</button>
                  </form>
                ) : (
                  <form action={doDelete} className="w-full">
                    <input type="hidden" name="id" value={m.id} />
                    <ConfirmDangerClient
                      disabled={!canSoftDelete}
                      buttonLabel="Usuń"
                      className={BTN_RED}
                    />
                  </form>
                )
              ) : (
                <button
                  type="button"
                  disabled
                  className="w-full px-3 py-2 rounded-md border border-border bg-background/30 text-foreground/50 cursor-not-allowed text-xs font-medium"
                >
                  Usuń
                </button>
              )}

              {/* Transfer (zielony) */}
              <div
                className={[
                  "[&>button]:w-full",
                  "[&>button]:px-3 [&>button]:py-2",
                  "[&>button]:rounded-md [&>button]:border",
                  "[&>button]:border-emerald-500/40 [&>button]:bg-emerald-500/10",
                  "[&>button]:text-emerald-200 [&>button]:hover:bg-emerald-500/15",
                  "[&>button]:transition [&>button]:text-xs [&>button]:font-medium",
                ].join(" ")}
              >
                <TransferMaterialModalClient
                  canWrite={canWrite}
                  materialId={m.id}
                  fromLocationId={m.inventory_location_id}
                  fromLocationLabel={m.inventory_location_label}
                  unit={m.unit}
                  fromQty={toNum(m.current_quantity)}
                  locations={(locations ?? []).map((l: any) => ({
                    id: String(l.id),
                    label: String(l.label),
                  }))}
                  sameTitleRows={(sameTitleRows ?? []) as any}
                  action={transferFromMaterialCard}
                />
              </div>

              {/* Zapisz zmiany — full width na mobile */}
              {canWrite ? (
                <div className="col-span-2 sm:col-span-1">
                  <ConfirmSaveClient
                    formId="materialSaveForm"
                    disabled={!canWrite}
                    buttonLabel="Zapisz zmiany"
                    className={BTN_NEUTRAL}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  disabled
                  className="col-span-2 sm:col-span-1 w-full px-3 py-2 rounded-md border border-border bg-background/30 text-foreground/50 cursor-not-allowed text-xs font-medium"
                >
                  Zapisz zmiany
                </button>
              )}
            </div>
          </div>

          {!canWrite ? (
            <div className="rounded-2xl border border-border bg-card p-4 text-sm opacity-75">
              Ten użytkownik ma tryb <b>tylko do odczytu</b>.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}