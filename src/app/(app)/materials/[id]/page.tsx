// src/app/(app)/materials/[id]/page.tsx

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";
import { updateMaterial, softDeleteMaterial, restoreMaterial } from "@/lib/actions";
import { PERM } from "@/lib/permissions";
import BackButton from "@/components/BackButton";

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

  // Format A: { role, permissions } albo [ { role, permissions } ]
  const obj = Array.isArray(data) ? (data[0] ?? null) : data;
  if (obj && typeof obj === "object") {
    const a = obj as SnapshotA;
    if (Array.isArray(a.permissions))
      out.permSet = new Set(a.permissions.map((x) => String(x)));
    if (typeof a.role === "string") out.role = a.role;
    if (typeof a.account_id === "string") out.account_id = a.account_id;
    if (typeof a.current_account_id === "string")
      out.current_account_id = a.current_account_id;

    if (out.permSet.size > 0 || out.role) return out;
  }

  // Format B: [{ key, allowed }]
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

// worker/foreman mają być read-only, niezależnie od ewentualnych błędów w permach
function isReadOnlyRole(role: string | null) {
  const r = (role ?? "").toLowerCase();
  return r === "worker" || r === "foreman";
}

/* =========================    Helpers ========================= */

const UNIT_OPTIONS = [
  { value: "szt", label: "szt" },
  { value: "paczka", label: "paczka" },
  { value: "opak", label: "opak" },
  { value: "kg", label: "kg" },
  { value: "l", label: "l" },
  { value: "m", label: "m" },
  { value: "m2", label: "m²" },
  { value: "m3", label: "m³" },
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

/* =========================    Server Actions (GATED) ========================= */

async function saveMaterial(formData: FormData) {
  "use server";

  const snap = await getSnapshot();
  if (!has(snap.permSet, PERM.MATERIALS_WRITE)) return;
  if (isReadOnlyRole(snap.role)) return;

  const id = String(formData.get("id") || "");
  if (!id) return;

  const patch: Record<string, unknown> = {};

  // text fields
  for (const key of ["title", "description", "cta_url", "unit"] as const) {
    if (!formData.has(key)) continue;
    const v = formData.get(key);
    const str = v == null ? "" : String(v).trim();
    if (str === "") {
      if (key === "description" || key === "cta_url") patch[key] = null;
      continue;
    }
    patch[key] = str;
  }

  // numbers
  for (const key of ["base_quantity", "current_quantity"] as const) {
    if (!formData.has(key)) continue;
    const v = Number(formData.get(key));
    patch[key] = Number.isFinite(v) ? v : 0;
  }

  await updateMaterial(id, patch);

  // ✅ feedback po zapisie (bez client state)
  redirect(`/materials/${id}?saved=1`);
}

async function uploadMaterialImage(formData: FormData) {
  "use server";

  const snap = await getSnapshot();
  if (!has(snap.permSet, PERM.MATERIALS_WRITE)) return;
  if (isReadOnlyRole(snap.role)) return;

  const id = String(formData.get("id") || "");
  if (!id) return;

  const file = formData.get("image");
  if (!(file instanceof File) || !file.size) return;

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
    return;
  }

  const ext = safeExt(file.name);
  const fileName = `${Date.now()}.${ext}`;
  const path = `${accountId}/materials/${id}/${fileName}`;

  const { error: upErr } = await sb.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || "application/octet-stream",
  });

  if (upErr) {
    console.error("uploadMaterialImage upload error:", upErr);
    return;
  }

  const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = pub?.publicUrl;

  if (publicUrl) {
    await updateMaterial(id, { image_url: publicUrl });
  } else {
    await updateMaterial(id, { image_url: null });
    console.warn("material-images bucket is not public; consider signed URLs");
  }
}

async function doDelete(formData: FormData) {
  "use server";
  const snap = await getSnapshot();
  if (!has(snap.permSet, PERM.MATERIALS_SOFT_DELETE)) return;
  if (isReadOnlyRole(snap.role)) return;

  const id = String(formData.get("id") || "");
  if (id) await softDeleteMaterial(id);
}

async function doRestore(formData: FormData) {
  "use server";
  const snap = await getSnapshot();
  if (!has(snap.permSet, PERM.MATERIALS_SOFT_DELETE)) return;
  if (isReadOnlyRole(snap.role)) return;

  const id = String(formData.get("id") || "");
  if (id) await restoreMaterial(id);
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
  cta_url: string | null;
  created_at: string | null;
  deleted_at: string | null;
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

function sp(
  searchParams: { [key: string]: string | string[] | undefined } | undefined,
  key: string
) {
  const v = searchParams?.[key];
  return Array.isArray(v) ? v[0] : v;
}

async function fetchMaterialWithOptionalDeletedBy(
  sb: Awaited<ReturnType<typeof supabaseServer>>,
  id: string
) {
  const try1 = await sb
    .from("materials")
    .select(
      "id,title,description,unit,base_quantity,current_quantity,image_url,cta_url,created_at,deleted_at,deleted_by"
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
    msg.toLowerCase().includes("column") &&
    msg.toLowerCase().includes("deleted_by");
  if (!missingColumn)
    console.error("materials select (with deleted_by) error:", try1.error);

  const try2 = await sb
    .from("materials")
    .select(
      "id,title,description,unit,base_quantity,current_quantity,image_url,cta_url,created_at,deleted_at"
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

function AutoHideSavedScript() {
  const js = `
(function(){
  try {
    var el = document.getElementById('materialSavedToast');
    if (!el) return;
    window.setTimeout(function(){
      try {
        el.style.transition = 'opacity 200ms ease';
        el.style.opacity = '0';
        window.setTimeout(function(){ el.remove(); }, 220);
      } catch(e) {}
    }, 5000);
  } catch(e) {}
})();`;
  // eslint-disable-next-line react/no-danger
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}

export default async function MaterialDetailsPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const spObj = searchParams ? await searchParams : undefined;

  const snap = await getSnapshot();
  if (!has(snap.permSet, PERM.MATERIALS_READ)) redirect("/");

  const canWrite =
    has(snap.permSet, PERM.MATERIALS_WRITE) && !isReadOnlyRole(snap.role);
  const canSoftDelete =
    has(snap.permSet, PERM.MATERIALS_SOFT_DELETE) && !isReadOnlyRole(snap.role);

  const sb = await supabaseServer();
  const { row: m } = await fetchMaterialWithOptionalDeletedBy(sb, id);

  const saved = sp(spObj, "saved") === "1";

  if (!m) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-end">
          <BackButton className="inline-flex border border-border rounded px-3 py-2 bg-card hover:bg-card/80 text-sm" />
        </div>
        <p className="text-sm opacity-70">
          Materiał nie istnieje albo nie masz do niego dostępu.
        </p>
      </div>
    );
  }

  const pct =
    m.base_quantity > 0
      ? Math.round((m.current_quantity / m.base_quantity) * 100)
      : 0;

  const deletedByMember = m.deleted_at
    ? await fetchDeletedByMember(sb, (m as MaterialRowWithDeletedBy).deleted_by)
    : null;

  const ctaHasUrl = Boolean((m.cta_url ?? "").trim());

  return (
    <div className="p-6 space-y-6">
      {/* Back po prawej, styl jak inne guziki, logika "wróć do miejsca" z BackButton */}
      <div className="flex items-center justify-end">
        <BackButton className="inline-flex border border-border rounded px-3 py-2 bg-card hover:bg-card/80 text-sm" />
      </div>

      {/* Feedback po zapisie — znika po 5s */}
      {saved && (
        <div
          id="materialSavedToast"
          className="border border-border rounded-xl bg-card px-4 py-3 text-sm"
        >
          ✅ Zmiany zostały zapisane.
          <AutoHideSavedScript />
        </div>
      )}

      {/* Deleted badge + meta */}
      {m.deleted_at && (
        <div className="space-y-2">
          <div className="inline-block text-xs px-2 py-1 rounded bg-red-500/20 border border-red-500/40">
            usunięty
          </div>
          <div className="text-xs opacity-70">
            <span className="opacity-80">Usunięto:</span> {fmtWhen(m.deleted_at)}
            {deletedByMember ? (
              <>
                {" "}
                <span className="opacity-50">·</span>{" "}
                <span className="opacity-80">przez:</span>{" "}
                {deletedByMember.first_name || deletedByMember.last_name ? (
                  <span>
                    {deletedByMember.first_name ?? ""}{" "}
                    {deletedByMember.last_name ?? ""}
                  </span>
                ) : (
                  <span>{deletedByMember.email ?? "nieznany"}</span>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Layout:
          - mobile/tablet: stack (zdjęcie na górze)
          - desktop: 2 kolumny
          - LEWY BOX dopasowuje się do zawartości (nie jest rozciągany do prawego)
      */}
      <div className="grid gap-6 lg:grid-cols-[1fr_2fr] items-start">
        {/* MINIATURA: zdjęcie zawsze 1:1, box rośnie/kurczy gdy details otwierasz/zamykasz */}
        <div className="border border-border rounded-xl bg-card p-4 space-y-3">
          <div className="aspect-square rounded bg-background/50 border border-border/60 overflow-hidden flex items-center justify-center text-xs opacity-60">
            {m.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.image_url} className="w-full h-full object-cover" alt="" />
            ) : (
              "brak miniatury"
            )}
          </div>

          {/* ✅ ZMIANA: tylko widok uploadu -> taki sam styl jak w modalu tasków,
              ale informacja: można dodać tylko jedno zdjęcie */}
          {canWrite && (
            <details className="group border border-border/60 rounded-xl bg-background/20 overflow-hidden">
              <summary className="cursor-pointer select-none px-4 py-3 text-xs font-semibold text-foreground/80 hover:bg-background/30 transition">
                Dodaj / zmień zdjęcie
              </summary>

              <div className="p-4 space-y-2">
                <div className="text-[11px] text-foreground/60">
                  Możesz dodać tylko <strong>jedno</strong> zdjęcie.
                </div>

                <form action={uploadMaterialImage} encType="multipart/form-data" className="space-y-2">
                  <input type="hidden" name="id" value={m.id} />

                  <input
                    type="file"
                    name="image"
                    accept="image/*"
                    className="hidden"
                    id={`material-image-input-${m.id}`}
                  />

                  <label
                    htmlFor={`material-image-input-${m.id}`}
                    className={[
                      "block w-full rounded-xl border border-dashed border-border/70 bg-background/30 px-4 py-5",
                      "text-[11px] text-center text-foreground/70 cursor-pointer",
                      "hover:border-foreground/60 transition",
                    ].join(" ")}
                  >
                    <div>Kliknij, aby wybrać zdjęcie.</div>
                    <div className="mt-1 text-[10px] text-foreground/50">
                      JPG/PNG/WEBP • 1 plik
                    </div>
                  </label>

                  <button className="w-full rounded-full bg-foreground text-background px-5 py-2 text-[11px] font-semibold hover:bg-foreground/90 transition">
                    Zapisz zdjęcie
                  </button>
                </form>

                <div className="text-[10px] text-foreground/50">
                  Po zapisie miniatura odświeży się po przeładowaniu strony (SSR).
                </div>
              </div>
            </details>
          )}
        </div>

        {/* DANE */}
        <div className="space-y-6">
          <form
            action={saveMaterial}
            className="border border-border rounded-xl bg-card p-4 space-y-4"
          >
            <input type="hidden" name="id" value={m.id} />

            <div className="grid gap-2">
              <label className="text-sm opacity-80">Nazwa</label>
              <input
                name="title"
                defaultValue={m.title}
                disabled={!canWrite}
                className="w-full border rounded px-3 py-2 bg-background disabled:opacity-60 hover:bg-foreground/5 transition"
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm opacity-80">Opis</label>
              <textarea
                name="description"
                defaultValue={m.description ?? ""}
                disabled={!canWrite}
                className="w-full border rounded px-3 py-2 bg-background disabled:opacity-60 hover:bg-foreground/5 transition"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="grid gap-2">
                <label className="text-sm opacity-80">Baza</label>
                <input
                  name="base_quantity"
                  type="number"
                  step="0.01"
                  defaultValue={m.base_quantity}
                  disabled={!canWrite}
                  className="border rounded px-3 py-2 bg-background disabled:opacity-60 hover:bg-foreground/5 transition"
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm opacity-80">Stan</label>
                <input
                  name="current_quantity"
                  type="number"
                  step="0.01"
                  defaultValue={m.current_quantity}
                  disabled={!canWrite}
                  className="border rounded px-3 py-2 bg-background disabled:opacity-60 hover:bg-foreground/5 transition"
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm opacity-80">Miara</label>
                <select
                  name="unit"
                  defaultValue={m.unit ?? "szt"}
                  disabled={!canWrite}
                  className="border rounded px-3 py-2 bg-background disabled:opacity-60 hover:bg-foreground/5 transition"
                >
                  {UNIT_OPTIONS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* CTA */}
            <div className="grid gap-2">
              <label className="text-sm opacity-80">Zamów</label>

              {ctaHasUrl ? (
                <a
                  href={m.cta_url as string}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center px-4 py-2 border rounded bg-foreground text-background hover:opacity-90 transition"
                >
                  Zamów ten produkt →
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center justify-center px-4 py-2 border rounded bg-foreground/20 text-foreground/60 cursor-not-allowed"
                  title="Brak linku do zakupu"
                >
                  Zamów ten produkt →
                </button>
              )}

              {canWrite && (
                <details className="group border border-border/60 rounded-lg bg-background/30">
                  <summary className="cursor-pointer select-none px-3 py-2 text-sm opacity-80 hover:opacity-100 hover:bg-foreground/5 rounded-lg transition">
                    Dodaj / zmień link
                  </summary>
                  <div className="p-3 pt-2 space-y-2">
                    <input
                      name="cta_url"
                      type="url"
                      defaultValue={m.cta_url ?? ""}
                      placeholder="https://…"
                      className="w-full border rounded px-3 py-2 bg-background hover:bg-foreground/5 transition"
                    />
                    <div className="text-xs opacity-60">
                      Ten link będzie użyty przez przycisk „Zamów ten produkt”.
                    </div>
                  </div>
                </details>
              )}

              {!canWrite && (
                <div className="text-xs opacity-60">
                  Jeśli będzie ustawiony link — przycisk „Zamów” zadziała.
                </div>
              )}
            </div>

            {canWrite && (
              <div className="flex justify-end">
                <button className="px-4 py-2 border rounded bg-foreground/10 hover:bg-foreground/15 transition">
                  Zapisz zmiany
                </button>
              </div>
            )}
          </form>

          {/* STAN */}
          <div className="border border-border rounded-xl bg-card p-4 space-y-2">
            <div className="text-sm">
              Stan: {m.current_quantity} / {m.base_quantity} {m.unit} ({pct}%)
            </div>
            <div className="h-2 rounded bg-background/60 overflow-hidden">
              <div
                className={`h-full ${pct <= 25 ? "bg-red-500" : "bg-foreground"}`}
                style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
              />
            </div>
          </div>

          {/* DELETE / RESTORE */}
          {canSoftDelete && (
            <div className="flex gap-2">
              {m.deleted_at ? (
                <form action={doRestore}>
                  <input type="hidden" name="id" value={m.id} />
                  <button className="px-3 py-2 border rounded bg-green-600/20 hover:bg-green-600/25 transition">
                    Przywróć
                  </button>
                </form>
              ) : (
                <form action={doDelete}>
                  <input type="hidden" name="id" value={m.id} />
                  <button className="px-3 py-2 border rounded bg-red-600/20 hover:bg-red-600/25 transition">
                    Usuń
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
