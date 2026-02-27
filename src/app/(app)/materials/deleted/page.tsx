// src/app/(app)/materials/deleted/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";

import BackButton from "@/components/BackButton";
import { supabaseServer } from "@/lib/supabaseServer";
import { restoreMaterial } from "@/lib/actions";
import { PERM } from "@/lib/permissions";
import { fetchInventoryLocations } from "@/lib/queries/inventoryLocations";

import MaterialsDeletedSearchPanel from "@/app/(app)/materials/_components/MaterialsDeletedSearchPanel";

type SnapshotA = { role?: string | null; permissions?: string[] };
type SnapshotRow = { key: string; allowed: boolean };

type Snapshot = {
  role: string | null;
  permSet: Set<string>;
};

async function getSnapshot(): Promise<Snapshot> {
  const sb = await supabaseServer();
  const { data, error } = await sb.rpc("my_permissions_snapshot");
  if (error || !data) return { role: null, permSet: new Set() };

  const obj = Array.isArray(data) ? (data[0] ?? null) : data;
  if (obj && typeof obj === "object") {
    const a = obj as SnapshotA;
    const perms = Array.isArray(a.permissions) ? a.permissions : [];
    const role = typeof a.role === "string" ? a.role : null;
    if (perms.length || role) {
      return { role, permSet: new Set(perms.map((x) => String(x))) };
    }
  }

  if (Array.isArray(data)) {
    const rows = data as any as SnapshotRow[];
    return {
      role: null,
      permSet: new Set(
        rows
          .filter((r) => r?.allowed)
          .map((r) => String(r.key))
          .filter(Boolean)
      ),
    };
  }

  return { role: null, permSet: new Set() };
}

function can(s: Snapshot, key: string) {
  return s.permSet.has(key);
}

function canEnterDeleted(s: Snapshot) {
  const r = (s.role ?? "").toLowerCase();
  return r === "owner" || r === "manager" || r === "storeman";
}

function sp(o: { [k: string]: string | string[] | undefined }, k: string) {
  const v = o?.[k];
  return Array.isArray(v) ? v[0] : v;
}

function toNum(v: unknown) {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v) || 0;
  return 0;
}

function clampPct(p: number) {
  return Math.max(0, Math.min(100, p));
}

function fmtWhen(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("pl-PL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const SORT_KEYS = ["deleted_at", "title", "created_at"] as const;
type SortKey = (typeof SORT_KEYS)[number];
const DIRS = ["asc", "desc"] as const;
type Dir = (typeof DIRS)[number];

type MaterialRowBase = {
  id: string;
  title: string;
  unit: string;
  base_quantity: number;
  current_quantity: number;
  image_url: string | null;
  deleted_at: string | null;
  created_at: string | null;

  inventory_location_id?: string | null;
  inventory_location_label?: string | null;
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

async function doRestore(formData: FormData) {
  "use server";
  const snap = await getSnapshot();
  if (!can(snap, PERM.MATERIALS_SOFT_DELETE)) return;

  const id = String(formData.get("id") || "").trim();

  // paramy do powrotu (żeby UX po restore był “pokaż toast” i zostań w filtrach)
  const q = formData.get("q")?.toString().trim() || "";
  const sort = formData.get("sort")?.toString() || "deleted_at";
  const dir = formData.get("dir")?.toString() || "desc";
  const loc = formData.get("loc")?.toString().trim() || "";
  const page = formData.get("page")?.toString() || "1";

  const p = new URLSearchParams();
  if (q) p.set("q", q);
  if (loc) p.set("loc", loc);
  p.set("sort", sort);
  p.set("dir", dir);
  p.set("page", page);

  if (!id) {
    p.set("toast", "Nie udało się przywrócić materiału.");
    p.set("tone", "err");
    redirect(`/materials/deleted?${p.toString()}`);
  }

  // ✅ WAŻNE: redirect() nie może być w try/catch, bo redirect rzuca wyjątek
  let ok = false;

  try {
    await restoreMaterial(id);
    ok = true;
  } catch {
    ok = false;
  }

  if (ok) {
    p.set("toast", "Materiał został przywrócony pomyślnie.");
    p.set("tone", "ok");
  } else {
    p.set("toast", "Nie udało się przywrócić materiału.");
    p.set("tone", "err");
  }

  redirect(`/materials/deleted?${p.toString()}`);
}

// --- stałe selekty (bez dynamicznego template stringa) ---
const SELECT_BASE = "id,title,unit,base_quantity,current_quantity,image_url,deleted_at,created_at";
const SELECT_WITH_DELETED_BY =
  "id,title,unit,base_quantity,current_quantity,image_url,deleted_at,created_at,deleted_by";
const SELECT_WITH_LOC =
  "id,title,unit,base_quantity,current_quantity,image_url,deleted_at,created_at,inventory_location_id,inventory_location_label";
const SELECT_WITH_ALL =
  "id,title,unit,base_quantity,current_quantity,image_url,deleted_at,created_at,deleted_by,inventory_location_id,inventory_location_label";

export default async function DeletedMaterialsPage({
  searchParams = {},
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const sb = await supabaseServer();
  const snap = await getSnapshot();

  if (!canEnterDeleted(snap)) redirect("/materials");

  const canRestore = can(snap, PERM.MATERIALS_SOFT_DELETE);

  const q = (sp(searchParams, "q") ?? "").trim();
  const loc = (sp(searchParams, "loc") ?? "").trim();

  const sortRaw = (sp(searchParams, "sort") ?? "deleted_at") as SortKey;
  const sort: SortKey = (SORT_KEYS as readonly string[]).includes(sortRaw) ? sortRaw : "deleted_at";

  const dirRaw = (sp(searchParams, "dir") ?? "desc") as Dir;
  const dir: Dir = (DIRS as readonly string[]).includes(dirRaw) ? dirRaw : "desc";

  const page = Math.max(1, Number(sp(searchParams, "page") ?? 1));
  const limit = 100;
  const offset = (page - 1) * limit;

  // --- PROBE: sprawdź czy kolumny istnieją (minimalny select) ---
  const probe = await sb
    .from("materials")
    .select("id,deleted_by,inventory_location_id,inventory_location_label")
    .not("deleted_at", "is", null)
    .range(0, 0);

  const probeMsg = (probe.error?.message ?? "").toLowerCase();
  const missingDeletedBy = probeMsg.includes("column") && probeMsg.includes("deleted_by");
  const missingLocCols =
    probeMsg.includes("column") &&
    (probeMsg.includes("inventory_location_id") || probeMsg.includes("inventory_location_label"));

  // ✅ WSZYSTKIE lokacje (aktywne + usunięte) + fallback z materials (historycznie)
  const locationsRaw = await fetchInventoryLocations({ includeDeleted: true });

  type LocEntry = {
    id: string;
    label: string;
    kind: "active" | "deleted" | "archived";
  };

  const locMap = new Map<string, LocEntry>();

  // 1) inventory_locations: aktywne + usunięte (najbardziej zaufane)
  for (const l of locationsRaw as any[]) {
    const id = String(l?.id ?? "").trim();
    if (!id) continue;

    const baseLabel = String(l?.label ?? "").trim() || "—";
    const isDeleted = Boolean(l?.deleted_at);

    locMap.set(id, {
      id,
      label: isDeleted ? `${baseLabel} (usunięta)` : baseLabel,
      kind: isDeleted ? "deleted" : "active",
    });
  }

  // 2) fallback z materials: archiwalne (mogą istnieć po hard-delete lokacji)
  if (!missingLocCols) {
    const hist = await sb
      .from("materials")
      .select("inventory_location_id,inventory_location_label")
      .not("inventory_location_id", "is", null)
      .limit(2000);

    if (hist.data && !hist.error) {
      for (const r of hist.data as any[]) {
        const id = String(r?.inventory_location_id ?? "").trim();
        if (!id) continue;

        // jeśli inventory_locations już ma tę lokację, nie dokładamy archiwalnej kopii
        if (locMap.has(id)) continue;

        const baseLabel = String(r?.inventory_location_label ?? "").trim();
        const label = baseLabel && baseLabel !== "—" ? `${baseLabel} (archiwalna)` : "Archiwalna lokacja";

        locMap.set(id, { id, label, kind: "archived" });
      }
    }
  }

  // 3) sort: aktywne → usunięte → archiwalne, a w środku po label
  const ORDER: Record<LocEntry["kind"], number> = {
    active: 0,
    deleted: 1,
    archived: 2,
  };

  const locations = Array.from(locMap.values())
    .sort((a, b) => {
      const da = ORDER[a.kind] - ORDER[b.kind];
      if (da !== 0) return da;
      return a.label.localeCompare(b.label, "pl");
    })
    .map((x) => ({ id: x.id, label: x.label }));

  // Jeśli user filtruje po loc, a nie ma kolumn -> UX: pusto
  if (loc && missingLocCols) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold">Katalog materiałów</h1>
          <BackButton className="card inline-flex items-center px-3 py-2 text-xs font-medium" />
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
          <div>
            <div className="text-sm opacity-70">Widok</div>
            <div className="text-lg font-semibold">Usunięte materiały</div>
          </div>

          <div className="rounded-2xl border border-border bg-background/20 p-4">
            <MaterialsDeletedSearchPanel initial={{ q, sort, dir, page, loc }} locations={locations} />
          </div>
        </div>

        <div className="border border-dashed border-border rounded p-8 text-center text-sm opacity-75">
          Ta baza nie ma jeszcze kolumn lokacji dla materiałów — filtr lokacji nie może działać.
        </div>
      </div>
    );
  }

  // wybierz bezpieczny select
  const selectStr =
    !missingDeletedBy && !missingLocCols
      ? SELECT_WITH_ALL
      : !missingDeletedBy && missingLocCols
      ? SELECT_WITH_DELETED_BY
      : missingDeletedBy && !missingLocCols
      ? SELECT_WITH_LOC
      : SELECT_BASE;

  let query = sb.from("materials").select(selectStr, { count: "exact" }).not("deleted_at", "is", null);

  if (q) query = query.ilike("title", `%${q}%`);
  if (loc && !missingLocCols) query = query.eq("inventory_location_id", loc);

  query = query.order(sort, {
    ascending: dir === "asc",
    nullsFirst: sort !== "deleted_at",
  });

  const { data, error } = await query.range(offset, offset + limit - 1);

  if (error) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-card p-4 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Usunięte materiały</h1>
          <BackButton className="card inline-flex items-center px-3 py-2 text-xs font-medium" />
        </div>

        <pre className="text-red-400 text-sm whitespace-pre-wrap">DB error: {error.message}</pre>
      </div>
    );
  }

  const rows: MaterialRowWithDeletedBy[] = (Array.isArray(data) ? data : []).map((m: any) => ({
    id: String(m.id),
    title: String(m.title ?? ""),
    unit: String(m.unit ?? ""),
    base_quantity: toNum(m.base_quantity),
    current_quantity: toNum(m.current_quantity),
    image_url: m.image_url ?? null,
    deleted_at: m.deleted_at ?? null,
    created_at: m.created_at ?? null,
    inventory_location_id: m.inventory_location_id ?? null,
    inventory_location_label: m.inventory_location_label ?? null,
    deleted_by: m.deleted_by ?? null,
  }));

  const mkHref = (p: number) => {
    const s = new URLSearchParams();
    if (q) s.set("q", q);
    if (loc) s.set("loc", loc);
    s.set("sort", sort);
    s.set("dir", dir);
    s.set("page", String(p));
    return `/materials/deleted?${s.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold">Katalog materiałów</h1>
        <BackButton className="card inline-flex items-center px-3 py-2 text-xs font-medium" />
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm opacity-70">Widok</div>
            <div className="text-lg font-semibold">Usunięte materiały</div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-background/20 p-4">
          <MaterialsDeletedSearchPanel initial={{ q, sort, dir, page, loc }} locations={locations} />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="border border-dashed border-border rounded p-8 text-center text-sm opacity-75">
          Brak usuniętych materiałów.
        </div>
      ) : (
        <ul className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {await Promise.all(
            rows.map(async (m) => {
              const base = toNum(m.base_quantity);
              const cur = toNum(m.current_quantity);
              const pct = base > 0 ? Math.round((cur / base) * 100) : 0;

              const deletedByMember =
                m.deleted_at && (m as any).deleted_by ? await fetchDeletedByMember(sb, (m as any).deleted_by ?? null) : null;

              const locLabel = (m as any)?.inventory_location_label ?? "—";

              return (
                <li
                  key={m.id}
                  className="rounded-2xl border border-border bg-card overflow-hidden transition hover:bg-background/10 hover:border-border/80"
                >
                  <Link href={`/materials/${m.id}`} className="block transition hover:bg-background/10">
                    <div className="p-4">
                      <div className="flex gap-4">
                        <div className="w-28 h-28 rounded-xl overflow-hidden bg-background/50 border border-border flex-shrink-0 relative">
                          {m.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={m.image_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-xs opacity-60">brak zdjęcia</div>
                          )}

                          <div className="absolute bottom-2 left-2 text-[11px] px-2 py-1 rounded bg-red-500/20 border border-red-500/30 text-red-200">
                            usunięty
                          </div>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-semibold truncate">{m.title}</div>

                              <div className="mt-1 text-xs opacity-70">
                                Usunięto: {fmtWhen(m.deleted_at)}
                                {deletedByMember ? (
                                  <>
                                    {" "}
                                    <span className="opacity-50">·</span> przez{" "}
                                    {deletedByMember.first_name || deletedByMember.last_name
                                      ? `${deletedByMember.first_name ?? ""} ${deletedByMember.last_name ?? ""}`.trim()
                                      : deletedByMember.email ?? "nieznany"}
                                  </>
                                ) : null}
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                              <span className="text-[11px] px-2 py-1 rounded bg-background/60 border border-border">{m.unit}</span>

                              <span className="text-[10px] px-2 py-1 rounded border border-emerald-500/35 bg-emerald-500/10 text-emerald-300">
                                {locLabel}
                              </span>
                            </div>
                          </div>

                          <div className="mt-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-sm opacity-70">Stan</span>
                                <span className="text-sm font-medium truncate">
                                  {cur} / {base} {m.unit}
                                </span>
                              </div>
                              <div className="text-sm font-medium opacity-80 flex-shrink-0">{pct}%</div>
                            </div>

                            <div className="mt-2 h-2 rounded bg-background/60 overflow-hidden">
                              <div
                                className={`h-full ${pct <= 25 ? "bg-red-500/70" : "bg-foreground/70"}`}
                                style={{ width: `${clampPct(pct)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>

                  {canRestore ? (
                    <div className="px-4 pb-4">
                      <form action={doRestore} className="flex justify-end">
                        <input type="hidden" name="id" value={m.id} />
                        <input type="hidden" name="q" value={q} />
                        <input type="hidden" name="sort" value={sort} />
                        <input type="hidden" name="dir" value={dir} />
                        <input type="hidden" name="loc" value={loc} />
                        <input type="hidden" name="page" value={String(page)} />

                        <button className="px-3 py-2 rounded border border-border bg-green-600/20 hover:bg-green-600/30 text-green-100 text-sm">
                          Przywróć
                        </button>
                      </form>
                    </div>
                  ) : (
                    <div className="px-4 pb-4 text-xs opacity-60 text-right">Brak uprawnienia do przywracania</div>
                  )}
                </li>
              );
            })
          )}
        </ul>
      )}

      <div className="flex items-center justify-between gap-3 pt-2">
        <Link
          href={mkHref(Math.max(1, page - 1))}
          className={`border border-border px-3 py-2 rounded bg-card hover:bg-card/80 ${page <= 1 ? "pointer-events-none opacity-50" : ""}`}
          aria-disabled={page <= 1}
        >
          ← Poprzednia
        </Link>

        <div className="text-sm opacity-70">Strona {page}</div>

        <Link
          href={mkHref(page + 1)}
          className={`border border-border px-3 py-2 rounded bg-card hover:bg-card/80 ${rows.length < limit ? "pointer-events-none opacity-50" : ""}`}
          aria-disabled={rows.length < limit}
        >
          Następna →
        </Link>
      </div>
    </div>
  );
}