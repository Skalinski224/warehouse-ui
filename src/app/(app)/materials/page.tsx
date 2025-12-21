// src/app/(app)/materials/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import BackButton from "@/components/BackButton";
import { createMaterial, softDeleteMaterial } from "@/lib/actions";
import { fetchMaterials } from "@/lib/queries/materials";
import type { MaterialOverview } from "@/lib/dto";
import { supabaseServer } from "@/lib/supabaseServer";
import { PERM } from "@/lib/permissions";

type SnapshotRow = { key: string; allowed: boolean };

async function getPermSet() {
  const sb = await supabaseServer();
  const { data, error } = await sb.rpc("my_permissions_snapshot");
  if (error || !data) return new Set<string>();

  // ✅ Format A: { permissions: string[] } (albo [ { permissions: string[] } ])
  const obj = Array.isArray(data) ? (data[0] ?? null) : data;
  if (obj && typeof obj === "object") {
    const perms = (obj as any)?.permissions;
    if (Array.isArray(perms)) {
      return new Set(perms.map((x) => String(x)));
    }
  }

  // ✅ Format B: [{ key, allowed }]
  if (Array.isArray(data)) {
    const rows: SnapshotRow[] = data as any;
    return new Set(
      rows
        .filter((r) => r?.allowed)
        .map((r) => String(r.key))
        .filter(Boolean)
    );
  }

  return new Set<string>();
}

function can(permSet: Set<string>, key: string) {
  return permSet.has(key);
}

/** Server Action – dodawanie materiału + redirect, żeby zamknąć modal */
async function addMaterial(formData: FormData) {
  "use server";

  const permSet = await getPermSet();
  if (!can(permSet, PERM.MATERIALS_WRITE)) return;

  await createMaterial(formData);

  const q = formData.get("q")?.toString().trim() || "";
  const sort = formData.get("sort")?.toString() || "title";
  const dir = formData.get("dir")?.toString() || "asc";
  const multi = formData.get("multi") === "1" ? "1" : "";
  const page = formData.get("page")?.toString() || "1";

  const p = new URLSearchParams();
  if (q) p.set("q", q);
  p.set("sort", sort);
  p.set("dir", dir);
  if (multi) p.set("multi", multi);
  p.set("page", page);

  redirect(`/materials?${p.toString()}`);
}

/** Server Action – usuń wiele materiałów na raz */
async function bulkDeleteMaterials(formData: FormData) {
  "use server";

  const permSet = await getPermSet();
  if (!can(permSet, PERM.MATERIALS_SOFT_DELETE)) return;

  const ids = formData.getAll("ids") as string[];
  if (!ids || ids.length === 0) return;

  for (const id of ids) {
    if (typeof id === "string" && id.trim().length > 0) {
      await softDeleteMaterial(id);
    }
  }
}

function sp(
  searchParams: { [key: string]: string | string[] | undefined },
  key: string
) {
  const v = searchParams?.[key];
  return Array.isArray(v) ? v[0] : v;
}

const SORT_KEYS = ["title", "current_quantity", "base_quantity", "created_at"] as const;
type SortKey = (typeof SORT_KEYS)[number];
const DIRS = ["asc", "desc"] as const;
type Dir = (typeof DIRS)[number];

type RawSearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

function clampPct(pct: number) {
  return Math.max(0, Math.min(100, pct));
}

function toNum(v: unknown) {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v) || 0;
  return 0;
}

/**
 * Auto-search + auto-refresh listy bez "use client":
 * - nasłuchuje inputa wyszukiwarki
 * - robi debounce 250ms
 * - składa GET na /materials z zachowaniem sort/dir/multi i page=1
 */
function AutoSearchScript() {
  const js = ` (function(){
  try {
    var form = document.getElementById('materialsSearchForm');
    var input = document.getElementById('materialsSearchInput');
    if (!form || !input) return;
    var t = null;
    input.addEventListener('input', function(){
      if (t) clearTimeout(t);
      t = setTimeout(function(){
        // zawsze wracamy na 1 stronę
        var page = form.querySelector('input[name="page"]');
        if (page) page.value = '1';
        form.requestSubmit ? form.requestSubmit() : form.submit();
      }, 250);
    });
  } catch(e) {}
})();`;
  // eslint-disable-next-line react/no-danger
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}

export default async function MaterialsPage({
  searchParams,
}: {
  searchParams: RawSearchParams;
}) {
  const spObj = await searchParams;

  // --- PERMISSIONS ---
  const permSet = await getPermSet();

  // gate wejścia na stronę
  if (!can(permSet, PERM.MATERIALS_READ)) redirect("/");

  // ✅ worker/foreman: tylko READ (brak write/soft_delete) → UI sam ukryje akcje
  // ✅ storeman/manager/owner: mają write + soft_delete → zobaczą wszystko
  const canWrite = can(permSet, PERM.MATERIALS_WRITE);
  const canSoftDelete = can(permSet, PERM.MATERIALS_SOFT_DELETE);

  // --- Query params ---
  const qRaw = sp(spObj, "q");
  const q = (qRaw ?? "").trim() || "";

  const sortRaw = (sp(spObj, "sort") ?? "title") as SortKey;
  const sort: SortKey = (SORT_KEYS as readonly string[]).includes(sortRaw)
    ? sortRaw
    : "title";

  const dirRaw = (sp(spObj, "dir") ?? "asc") as Dir;
  const dir: Dir = (DIRS as readonly string[]).includes(dirRaw) ? dirRaw : "asc";

  // tryby add/multi tylko gdy user ma uprawnienia
  const multi = canSoftDelete && sp(spObj, "multi") === "1";
  const add = canWrite && sp(spObj, "add") === "1";

  const page = Math.max(1, Number(sp(spObj, "page") ?? 1));
  const limit = 100; // ✅ wg wytycznych
  const offset = (page - 1) * limit;

  const rows: MaterialOverview[] = await fetchMaterials({
    q: q.trim() ? q.trim() : null,
    sort,
    dir,
    include_deleted: false,
    limit,
    offset,
  });

  const baseUrl = "/materials";
  const mkQuery = (
    overrides: Record<string, string | number | boolean | undefined>
  ) => {
    const p = new URLSearchParams();
    const qFinal = typeof overrides.q === "string" ? overrides.q : q;
    if (qFinal?.trim()) p.set("q", qFinal.trim());

    p.set("sort", String(overrides.sort ?? sort));
    p.set("dir", String(overrides.dir ?? dir));

    const multiFinal =
      typeof overrides.multi === "boolean" || typeof overrides.multi === "number"
        ? Boolean(overrides.multi)
        : multi;
    if (multiFinal && canSoftDelete) p.set("multi", "1");

    const addFinal =
      typeof overrides.add === "boolean" || typeof overrides.add === "number"
        ? Boolean(overrides.add)
        : false;
    if (addFinal && canWrite) p.set("add", "1");

    p.set("page", String(overrides.page ?? page));
    return `${baseUrl}?${p.toString()}`;
  };

  const showDesktopFilters = true; // desktop ma widzieć filtry normalnie
  const showMobileFilters = true; // mobile: pod ikoną

  return (
    <div className="p-6 space-y-6">
      {/* Header (tytuł zostaje czysty) */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Katalog materiałów</h1>
      </div>

      {/* ✅ Panel na filtry + guziki (jak na drugim screenie) */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
        {/* Górny pasek: akcje + cofnij */}
        <div className="flex items-center justify-between gap-3">
          {/* Desktop actions */}
          <div className="hidden md:flex items-center gap-2">
            {canSoftDelete && (
              <Link
                href="/materials/deleted"
                className="border border-border rounded px-3 py-2 bg-card hover:bg-card/80 text-sm"
              >
                Usunięte materiały
              </Link>
            )}

            {canWrite && (
              <Link
                href={mkQuery({ page: 1, add: true })}
                className="border border-border rounded px-3 py-2 bg-card hover:bg-card/80 text-sm"
              >
                + Dodaj materiał
              </Link>
            )}
          </div>

          {/* Mobile actions: 3 kropki */}
          {(canSoftDelete || canWrite) && (
            <div className="md:hidden">
              <details className="relative">
                <summary className="select-none cursor-pointer border border-border rounded px-3 py-2 bg-card hover:bg-card/80 text-sm">
                  ⋮
                </summary>
                <div className="absolute left-0 mt-2 w-52 z-20 rounded-xl border border-border bg-card shadow-xl overflow-hidden">
                  {canSoftDelete && (
                    <Link
                      href="/materials/deleted"
                      className="block px-3 py-2 text-sm hover:bg-background/40"
                    >
                      Usunięte materiały
                    </Link>
                  )}
                  {canWrite && (
                    <Link
                      href={mkQuery({ page: 1, add: true })}
                      className="block px-3 py-2 text-sm hover:bg-background/40"
                    >
                      + Dodaj materiał
                    </Link>
                  )}
                </div>
              </details>
            </div>
          )}

          {/* ✅ Cofnij w prawym górnym rogu panelu */}
          <BackButton className="card inline-flex items-center px-3 py-2 text-xs font-medium" />
        </div>

        {/* Toolbar */}
        <div className="flex flex-col gap-3">
          {/* Search (auto) */}
          <form id="materialsSearchForm" method="GET" className="w-full">
            <div className="flex items-center gap-2">
              <input
                id="materialsSearchInput"
                type="text"
                name="q"
                placeholder="Szukaj po nazwie…"
                defaultValue={q}
                className="w-full md:max-w-[520px] border border-border bg-background rounded px-3 py-2"
              />

              {/* zachowujemy pozostałe parametry */}
              <input type="hidden" name="sort" value={sort} />
              <input type="hidden" name="dir" value={dir} />
              {multi ? <input type="hidden" name="multi" value="1" /> : null}
              <input type="hidden" name="page" value={String(page)} />

              {/* Desktop: przycisk zostawiamy (ale auto też działa) */}
              <button
                type="submit"
                className="hidden md:inline-flex border border-border rounded px-3 py-2 bg-card hover:bg-card/80"
              >
                Szukaj
              </button>

              {/* Mobile: ikonka filtrów */}
              {showMobileFilters && (
                <div className="md:hidden ml-auto">
                  <details className="relative">
                    <summary className="select-none cursor-pointer border border-border rounded px-3 py-2 bg-card hover:bg-card/80 text-sm">
                      ⚙︎
                    </summary>
                    <div className="absolute right-0 mt-2 w-[320px] max-w-[85vw] z-20 rounded-2xl border border-border bg-card shadow-xl p-3 space-y-3">
                      <div className="grid gap-2">
                        <label className="text-xs opacity-80">Sortuj</label>
                        <select
                          name="sort"
                          defaultValue={sort}
                          className="border border-border bg-background rounded px-2 py-2"
                        >
                          <option value="title">Tytuł</option>
                          <option value="current_quantity">Stan</option>
                          <option value="base_quantity">Baza</option>
                          <option value="created_at">Data dodania</option>
                        </select>
                      </div>

                      <div className="grid gap-2">
                        <label className="text-xs opacity-80">Kierunek</label>
                        <select
                          name="dir"
                          defaultValue={dir}
                          className="border border-border bg-background rounded px-2 py-2"
                        >
                          <option value="asc">Rosnąco</option>
                          <option value="desc">Malejąco</option>
                        </select>
                      </div>

                      {canSoftDelete && (
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm opacity-80">Tryb: usuń kilka</span>
                          <Link
                            href={mkQuery({ page: 1, multi: !multi })}
                            className="text-sm border border-border rounded px-3 py-2 bg-background hover:bg-background/70"
                          >
                            {multi ? "Wyłącz" : "Włącz"}
                          </Link>
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="submit"
                          name="page"
                          value="1"
                          className="border border-border rounded px-3 py-2 bg-card hover:bg-card/80 text-sm"
                        >
                          Zastosuj
                        </button>
                      </div>
                    </div>
                  </details>
                </div>
              )}
            </div>

            <AutoSearchScript />
          </form>

          {/* Desktop filters (normalnie widoczne) */}
          {showDesktopFilters && (
            <div className="hidden md:flex flex-wrap items-end gap-3">
              {/* Sort + dir */}
              <form method="GET" className="flex flex-wrap items-end gap-2">
                {q.trim() ? <input type="hidden" name="q" value={q.trim()} /> : null}
                {multi ? <input type="hidden" name="multi" value="1" /> : null}
                <input type="hidden" name="page" value="1" />

                <label className="text-sm flex items-center gap-2">
                  Sortuj:
                  <select
                    name="sort"
                    defaultValue={sort}
                    className="border border-border bg-background rounded px-2 py-2"
                  >
                    <option value="title">Tytuł</option>
                    <option value="current_quantity">Stan</option>
                    <option value="base_quantity">Baza</option>
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
                    <option value="asc">Rosnąco</option>
                    <option value="desc">Malejąco</option>
                  </select>
                </label>

                <button className="border border-border rounded px-3 py-2 bg-card hover:bg-card/80">
                  Zastosuj
                </button>
              </form>

              {/* Multi delete toggle */}
              {canSoftDelete && (
                <div className="ml-auto flex items-center gap-2">
                  <Link
                    href={mkQuery({ page: 1, multi: !multi })}
                    className="text-sm border border-border rounded px-3 py-2 bg-card hover:bg-card/80"
                  >
                    {multi ? "Zakończ zaznaczanie" : "Usuń kilka"}
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal dodawania materiału – tylko canWrite */}
      {add && canWrite && (
        <div className="fixed inset-0 z-30 flex items-start justify-center pt-24 bg-background/70 backdrop-blur-sm">
          <div className="w-full max-w-xl mx-4 p-4 border border-border rounded-2xl bg-card shadow-xl">
            <form action={addMaterial} className="grid gap-3">
              <input type="hidden" name="q" value={q ?? ""} />
              <input type="hidden" name="sort" value={sort} />
              <input type="hidden" name="dir" value={dir} />
              <input type="hidden" name="page" value={page} />
              <input type="hidden" name="multi" value={multi ? "1" : ""} />

              <div className="grid gap-2">
                <label className="text-sm">Tytuł *</label>
                <input
                  name="title"
                  required
                  placeholder="np. Pręt fi10"
                  className="w-full border border-border bg-background rounded px-3 py-2"
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm">Opis</label>
                <textarea
                  name="description"
                  rows={2}
                  placeholder="Krótki opis (opcjonalnie)"
                  className="w-full border border-border bg-background rounded px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="grid gap-2">
                  <label className="text-sm">Jednostka</label>
                  <select
                    name="unit"
                    defaultValue="szt"
                    className="w-full border border-border bg-background rounded px-3 py-2"
                  >
                    <option value="szt">szt</option>
                    <option value="kg">kg</option>
                    <option value="m">m</option>
                    <option value="m2">m²</option>
                    <option value="m3">m³</option>
                    <option value="l">l</option>
                    <option value="opak">opak</option>
                  </select>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm">Baza *</label>
                  <input
                    type="number"
                    step="0.01"
                    name="base_quantity"
                    required
                    placeholder="100"
                    className="w-full border border-border bg-background rounded px-3 py-2"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm">Stan</label>
                  <input
                    type="number"
                    step="0.01"
                    name="current_quantity"
                    placeholder="0"
                    defaultValue={0}
                    className="w-full border border-border bg-background rounded px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <label className="text-sm">CTA URL</label>
                <input
                  name="cta_url"
                  type="url"
                  placeholder="https://sklep.example.com/produkt"
                  className="w-full border border-border bg-background rounded px-3 py-2"
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm">Miniaturka (opcjonalnie)</label>
                <input
                  type="file"
                  name="image"
                  accept="image/*"
                  className="w-full border border-border bg-background rounded px-3 py-2"
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <Link
                  href={mkQuery({ add: false })}
                  className="px-3 py-2 rounded border border-border bg-background text-sm"
                >
                  Anuluj
                </Link>
                <button className="px-3 py-2 rounded border border-border bg-card hover:bg-card/80 text-sm">
                  Dodaj
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lista materiałów */}
      {rows.length === 0 ? (
        <div className="border border-dashed border-border rounded p-8 text-center text-sm opacity-75">
          Brak wyników.
        </div>
      ) : multi && canSoftDelete ? (
        <form action={bulkDeleteMaterials} className="space-y-3">
          <div className="flex justify-end">
            <button
              type="submit"
              className="text-sm border border-red-500/60 text-red-200 rounded px-3 py-2 bg-red-500/10 hover:bg-red-500/20"
            >
              Usuń zaznaczone
            </button>
          </div>

          <ul className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {rows.map((m) => {
              const base = toNum(m.base_quantity);
              const cur = toNum(m.current_quantity);
              const pct = base > 0 ? Math.round((cur / base) * 100) : 0;

              return (
                <li
                  key={m.id}
                  className="rounded-2xl border border-border bg-card overflow-hidden relative transition hover:bg-background/10"
                >
                  <label className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-background/80 px-2 py-1 rounded text-xs">
                    <input type="checkbox" name="ids" value={m.id} className="accent-red-500" />
                    <span>Zaznacz</span>
                  </label>

                  {/* pointer-events-none: żeby nie klikać w kartę w trybie multi */}
                  <div className="pointer-events-none">
                    <div className="p-4">
                      <div className="flex gap-4">
                        {/* Image */}
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
                        </div>

                        {/* Content */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-semibold truncate">{m.title}</div>
                              {m.description ? (
                                <div className="mt-1 text-sm opacity-80 line-clamp-2">
                                  {m.description}
                                </div>
                              ) : (
                                <div className="mt-1 text-sm opacity-50 line-clamp-2">—</div>
                              )}
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
                  </div>
                </li>
              );
            })}
          </ul>
        </form>
      ) : (
        <ul className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {rows.map((m) => {
            const base = toNum(m.base_quantity);
            const cur = toNum(m.current_quantity);
            const pct = base > 0 ? Math.round((cur / base) * 100) : 0;

            return (
              <li
                key={m.id}
                className="rounded-2xl border border-border bg-card overflow-hidden transition hover:bg-background/10 hover:border-border/80"
              >
                <Link href={`/materials/${m.id}`} className="block transition hover:bg-background/10">
                  <div className="p-4">
                    <div className="flex gap-4">
                      {/* Image */}
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
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-semibold truncate">{m.title}</div>

                            {m.description ? (
                              <div className="mt-1 text-sm opacity-80 line-clamp-2">
                                {m.description}
                              </div>
                            ) : (
                              <div className="mt-1 text-sm opacity-50 line-clamp-2">—</div>
                            )}
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
              </li>
            );
          })}
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
