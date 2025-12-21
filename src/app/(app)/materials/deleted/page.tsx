// src/app/(app)/materials/deleted/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";

import BackButton from "@/components/BackButton";
import { supabaseServer } from "@/lib/supabaseServer";
import { restoreMaterial } from "@/lib/actions";
import { PERM } from "@/lib/permissions";

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

  // ✅ Format A: { role, permissions } lub [ { role, permissions } ]
  const obj = Array.isArray(data) ? (data[0] ?? null) : data;
  if (obj && typeof obj === "object") {
    const a = obj as SnapshotA;
    const perms = Array.isArray(a.permissions) ? a.permissions : [];
    const role = typeof a.role === "string" ? a.role : null;
    if (perms.length || role) {
      return { role, permSet: new Set(perms.map((x) => String(x))) };
    }
  }

  // ✅ Format B: [{ key, allowed }]
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

// ✅ Wejście: tylko storeman/owner/manager (twardo po roli)
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
};

type MaterialRowWithDeletedBy = MaterialRowBase & {
  deleted_by?: string | null; // opcjonalnie
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

/** Server Action – restore pojedynczego materiału */
async function doRestore(formData: FormData) {
  "use server";
  const snap = await getSnapshot();
  if (!can(snap, PERM.MATERIALS_SOFT_DELETE)) return;

  const id = String(formData.get("id") || "");
  if (id) await restoreMaterial(id);
}

export default async function DeletedMaterialsPage({
  searchParams = {},
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const sb = await supabaseServer();
  const snap = await getSnapshot();

  // ✅ Gate wejścia (role-based)
  if (!canEnterDeleted(snap)) redirect("/materials");

  // ✅ Restore tylko jeśli permission
  const canRestore = can(snap, PERM.MATERIALS_SOFT_DELETE);

  // Params
  const qRaw = sp(searchParams, "q");
  const q = (qRaw ?? "").trim();

  const sortRaw = (sp(searchParams, "sort") ?? "deleted_at") as SortKey;
  const sort: SortKey = (SORT_KEYS as readonly string[]).includes(sortRaw)
    ? sortRaw
    : "deleted_at";

  const dirRaw = (sp(searchParams, "dir") ?? "desc") as Dir;
  const dir: Dir = (DIRS as readonly string[]).includes(dirRaw) ? dirRaw : "desc";

  const page = Math.max(1, Number(sp(searchParams, "page") ?? 1));
  const limit = 100; // jak /materials
  const offset = (page - 1) * limit;

  // Query: tylko usunięte, z fallbackiem jeśli nie ma deleted_by
  const tryWithDeletedBy = await sb
    .from("materials")
    .select(
      "id,title,unit,base_quantity,current_quantity,image_url,deleted_at,created_at,deleted_by",
      { count: "exact" }
    )
    .not("deleted_at", "is", null);

  const missingDeletedBy =
    tryWithDeletedBy.error?.message?.toLowerCase?.().includes("column") &&
    tryWithDeletedBy.error.message.toLowerCase().includes("deleted_by");

  let query = missingDeletedBy
    ? sb
        .from("materials")
        .select(
          "id,title,unit,base_quantity,current_quantity,image_url,deleted_at,created_at",
          { count: "exact" }
        )
        .not("deleted_at", "is", null)
    : sb
        .from("materials")
        .select(
          "id,title,unit,base_quantity,current_quantity,image_url,deleted_at,created_at,deleted_by",
          { count: "exact" }
        )
        .not("deleted_at", "is", null);

  if (q) query = query.ilike("title", `%${q}%`);

  query = query.order(sort, {
    ascending: dir === "asc",
    nullsFirst: sort !== "deleted_at",
  });

  const { data, error } = await query.range(offset, offset + limit - 1);

  if (error) {
    return (
      <div className="p-6 space-y-4">
        <div className="rounded-2xl border border-border bg-card p-4 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Usunięte materiały</h1>
          <BackButton className="card inline-flex items-center px-3 py-2 text-xs font-medium" />
        </div>

        <pre className="text-red-400 text-sm whitespace-pre-wrap">
          DB error: {error.message}
        </pre>
      </div>
    );
  }

  const rows = (data ?? []) as MaterialRowWithDeletedBy[];

  const baseUrl = "/materials/deleted";
  const mkQuery = (overrides: Record<string, string | number>) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    p.set("sort", sort);
    p.set("dir", dir);
    p.set("page", String(overrides.page ?? page));
    return `${baseUrl}?${p.toString()}`;
  };

  return (
    <div className="p-6 space-y-6">
      {/* ✅ Panel: header + toolbar (szare tło) */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Usunięte materiały</h1>

          {/* ✅ Cofnij = BackButton, w panelu */}
          <BackButton className="card inline-flex items-center px-3 py-2 text-xs font-medium" />
        </div>

        {/* Toolbar (prosty, spójny) */}
        <div className="flex flex-col gap-3">
          <form method="GET" className="w-full">
            <div className="flex items-center gap-2">
              <input
                type="text"
                name="q"
                placeholder="Szukaj po nazwie…"
                defaultValue={q}
                className="w-full md:max-w-[520px] border border-border bg-background rounded px-3 py-2"
              />
              <input type="hidden" name="sort" value={sort} />
              <input type="hidden" name="dir" value={dir} />
              <input type="hidden" name="page" value="1" />
              <button className="hidden md:inline-flex border border-border rounded px-3 py-2 bg-card hover:bg-card/80">
                Szukaj
              </button>
            </div>
          </form>

          <div className="hidden md:flex flex-wrap items-end gap-3">
            <form method="GET" className="flex flex-wrap items-end gap-2">
              {q ? <input type="hidden" name="q" value={q} /> : null}
              <input type="hidden" name="page" value="1" />

              <label className="text-sm flex items-center gap-2">
                Sortuj:
                <select
                  name="sort"
                  defaultValue={sort}
                  className="border border-border bg-background rounded px-2 py-2"
                >
                  <option value="deleted_at">Data usunięcia</option>
                  <option value="title">Tytuł</option>
                  <option value="created_at">Data dodania</option>
                </select>
              </label>

              <label className="text-sm flex items-center gap-2">
                Kierunek:
                <select
                  name="dir"
                  defaultValue={dir}
                  className="border border-border bg-background rounded px-2 py-2"
                >
                  <option value="desc">Malejąco</option>
                  <option value="asc">Rosnąco</option>
                </select>
              </label>

              <button className="border border-border rounded px-3 py-2 bg-card hover:bg-card/80">
                Zastosuj
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Lista — identyczne karty jak /materials */}
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

              const deletedByMember = m.deleted_at
                ? await fetchDeletedByMember(sb, (m as any).deleted_by ?? null)
                : null;

              return (
                <li
                  key={m.id}
                  className="rounded-2xl border border-border bg-card overflow-hidden"
                >
                  {/* Klikalna część */}
                  <Link
                    href={`/materials/${m.id}`}
                    className="block hover:bg-background/10 transition"
                  >
                    <div className="p-4">
                      <div className="flex gap-4">
                        <div className="w-28 h-28 rounded-xl overflow-hidden bg-background/50 border border-border flex-shrink-0 relative">
                          {m.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={m.image_url}
                              alt=""
                              className="absolute inset-0 h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-xs opacity-60">
                              brak zdjęcia
                            </div>
                          )}

                          {/* ✅ Znacznik na dole pod zdjęciem */}
                          <div className="absolute bottom-2 left-2 text-[11px] px-2 py-1 rounded bg-red-500/20 border border-red-500/30 text-red-200">
                            usunięty
                          </div>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-semibold truncate">
                                {m.title}
                              </div>

                              <div className="mt-1 text-xs opacity-70">
                                Usunięto: {fmtWhen(m.deleted_at)}
                                {deletedByMember ? (
                                  <>
                                    {" "}
                                    <span className="opacity-50">·</span> przez{" "}
                                    {deletedByMember.first_name ||
                                    deletedByMember.last_name
                                      ? `${deletedByMember.first_name ?? ""} ${
                                          deletedByMember.last_name ?? ""
                                        }`.trim()
                                      : deletedByMember.email ?? "nieznany"}
                                  </>
                                ) : null}
                              </div>
                            </div>

                            <span className="text-[11px] px-2 py-1 rounded bg-background/60 border border-border flex-shrink-0">
                              {m.unit}
                            </span>
                          </div>

                          <div className="mt-3 text-sm opacity-90">
                            {cur} / {base} {m.unit} ({pct}%)
                          </div>

                          <div className="mt-2 h-2 rounded bg-background/60 overflow-hidden">
                            <div
                              className={`h-full ${
                                pct <= 25 ? "bg-red-500/70" : "bg-foreground/70"
                              }`}
                              style={{ width: `${clampPct(pct)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>

                  {/* Akcja — poza Linkiem */}
                  {canRestore ? (
                    <div className="px-4 pb-4">
                      <form action={doRestore} className="flex justify-end">
                        <input type="hidden" name="id" value={m.id} />
                        <button className="px-3 py-2 rounded border border-border bg-green-600/20 hover:bg-green-600/30 text-green-100 text-sm">
                          Przywróć
                        </button>
                      </form>
                    </div>
                  ) : (
                    <div className="px-4 pb-4 text-xs opacity-60 text-right">
                      Brak uprawnienia do przywracania
                    </div>
                  )}
                </li>
              );
            })
          )}
        </ul>
      )}

      {/* Pager */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <Link
          href={mkQuery({ page: Math.max(1, page - 1) })}
          className={`border border-border px-3 py-2 rounded bg-card hover:bg-card/80 ${
            page <= 1 ? "pointer-events-none opacity-50" : ""
          }`}
          aria-disabled={page <= 1}
        >
          ← Poprzednia
        </Link>

        <div className="text-sm opacity-70">Strona {page}</div>

        <Link
          href={mkQuery({ page: page + 1 })}
          className={`border border-border px-3 py-2 rounded bg-card hover:bg-card/80 ${
            rows.length < limit ? "pointer-events-none opacity-50" : ""
          }`}
          aria-disabled={rows.length < limit}
        >
          Następna →
        </Link>
      </div>
    </div>
  );
}
