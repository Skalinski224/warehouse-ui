// src/app/(app)/materials/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { createMaterial, softDeleteMaterial } from "@/lib/actions";
import { fetchMaterials } from "@/lib/queries/materials";
import type { MaterialOverview } from "@/lib/dto";
import { getCurrentRole, canEditInventory } from "@/lib/getCurrentRole";

/** Server Action – dodawanie materiału + redirect, żeby zamknąć modal */
async function addMaterial(formData: FormData) {
  "use server";

  await createMaterial(formData);

  // odczytujemy parametry filtrów z hiddenów,
  // żeby wrócić na ten sam widok po dodaniu
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

  const ids = formData.getAll("ids") as string[];

  if (!ids || ids.length === 0) return;

  for (const id of ids) {
    if (typeof id === "string" && id.trim().length > 0) {
      await softDeleteMaterial(id);
    }
  }
}

/** Helper do pobrania pojedynczego stringa z searchParams (obsługa string[]) */
function sp(
  searchParams: { [key: string]: string | string[] | undefined },
  key: string
) {
  const v = searchParams?.[key];
  return Array.isArray(v) ? v[0] : v;
}

/** Dozwolone klucze sortowania i kierunki */
const SORT_KEYS = [
  "title",
  "current_quantity",
  "base_quantity",
  "created_at",
] as const;
type SortKey = (typeof SORT_KEYS)[number];
const DIRS = ["asc", "desc"] as const;
type Dir = (typeof DIRS)[number];

// UWAGA: w Next 16 searchParams jest PROMISE
type RawSearchParams = Promise<{
  [key: string]: string | string[] | undefined;
}>;

export default async function MaterialsPage({
  searchParams,
}: {
  searchParams: RawSearchParams;
}) {
  const spObj = await searchParams;

  // --- ROLA UŻYTKOWNIKA ---
  const role = await getCurrentRole();
  const canEdit = canEditInventory(role); // owner/manager/storeman → true, worker → false

  // --- Query params ---
  const qRaw = sp(spObj, "q");
  const q = (qRaw ?? "").trim() || null;

  const sortRaw = (sp(spObj, "sort") ?? "title") as SortKey;
  const sort: SortKey = (SORT_KEYS as readonly string[]).includes(sortRaw)
    ? sortRaw
    : "title";

  const dirRaw = (sp(spObj, "dir") ?? "asc") as Dir;
  const dir: Dir = (DIRS as readonly string[]).includes(dirRaw) ? dirRaw : "asc";

  // tryb multi / add są dostępne TYLKO gdy użytkownik może edytować
  const multi = canEdit && sp(spObj, "multi") === "1";
  const add = canEdit && sp(spObj, "add") === "1";

  const page = Math.max(1, Number(sp(spObj, "page") ?? 1));
  const limit = 30;
  const offset = (page - 1) * limit;

  const rows: MaterialOverview[] = await fetchMaterials({
    q,
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
    if (q) p.set("q", q);
    p.set("sort", String(overrides.sort ?? sort));
    p.set("dir", String(overrides.dir ?? dir));

    const multiFinal =
      typeof overrides.multi === "boolean" || typeof overrides.multi === "number"
        ? Boolean(overrides.multi)
        : multi;
    if (multiFinal && canEdit) p.set("multi", "1");

    // add pokazujemy tylko wtedy, gdy jawnie go chcemy
    const addFinal =
      typeof overrides.add === "boolean" || typeof overrides.add === "number"
        ? Boolean(overrides.add)
        : false;
    if (addFinal && canEdit) p.set("add", "1");

    const newPage = String(overrides.page ?? page);
    p.set("page", newPage);
    return `${baseUrl}?${p.toString()}`;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Katalog materiałów</h1>
      </div>

      {/* Toolbar: search + sort/dir + prawa strona z przyciskami */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Search */}
        <form method="GET" className="flex-1 min-w-[260px] md:max-w-[33%]">
          <div className="flex gap-2">
            <input
              type="text"
              name="q"
              placeholder="Szukaj po nazwie…"
              defaultValue={q ?? ""}
              className="w-full border border-border bg-background rounded px-3 py-2"
            />
            <input type="hidden" name="sort" value={sort} />
            <input type="hidden" name="dir" value={dir} />
            {multi ? <input type="hidden" name="multi" value="1" /> : null}
            <input type="hidden" name="page" value="1" />
            <button className="border border-border rounded px-3 py-2 bg-card hover:bg-card/80">
              Szukaj
            </button>
          </div>
        </form>

        {/* Sort + dir + Zastosuj */}
        <form method="GET" className="flex flex-wrap items-end gap-2">
          {q ? <input type="hidden" name="q" value={q} /> : null}
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

        {/* Prawa strona: przyciski (tylko dla ról z uprawnieniami do edycji) */}
        {canEdit && (
          <div className="ml-auto flex gap-2">
            <Link
              href="/materials/deleted"
              className="border border-border rounded px-3 py-2 bg-card hover:bg-card/80 text-sm"
            >
              Usunięte materiały
            </Link>

            <Link
              href={mkQuery({ page: 1, add: true })}
              className="border border-border rounded px-3 py-2 bg-card hover:bg-card/80 text-sm"
            >
              + Dodaj materiał
            </Link>
          </div>
        )}
      </div>

      {/* Modal dodawania materiału – sterowany parametrem ?add=1, tylko gdy canEdit */}
      {add && canEdit && (
        <div className="fixed inset-0 z-30 flex items-start justify-center pt-24 bg-background/70 backdrop-blur-sm">
          <div className="w-full max-w-xl mx-4 p-4 border border-border rounded-2xl bg-card shadow-xl">
            <form action={addMaterial} className="grid gap-3">
              {/* hiddeny do odtworzenia filtrów po redirect */}
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

      {/* Przełącznik „Usuń kilka” – tylko gdy canEdit */}
      {canEdit && (
        <div className="flex items-center gap-3">
          <Link
            href={mkQuery({ page: 1, multi: !multi })}
            className="text-sm border border-border rounded px-3 py-1 bg-card hover:bg-card/80"
          >
            {multi ? "Zakończ zaznaczanie" : "Usuń kilka"}
          </Link>
        </div>
      )}

      {/* Lista materiałów */}
      {rows.length === 0 ? (
        <div className="border border-dashed border-border rounded p-8 text-center text-sm opacity-75">
          Brak wyników.
        </div>
      ) : multi && canEdit ? (
        <form action={bulkDeleteMaterials} className="space-y-3">
          <div className="flex justify-end">
            <button
              type="submit"
              className="text-sm border border-red-500/60 text-red-200 rounded px-3 py-1 bg-red-500/10 hover:bg-red-500/20"
            >
              Usuń zaznaczone
            </button>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((m) => {
              const pct =
                m.base_quantity && Number(m.base_quantity) > 0
                  ? Math.round(
                      (Number(m.current_quantity) /
                        Number(m.base_quantity)) *
                        100
                    )
                  : 0;

              return (
                <li
                  key={m.id}
                  className="rounded border border-border bg-card overflow-hidden relative"
                >
                  <label className="absolute top-2 left-2 z-10 flex items-center gap-2 bg-background/80 px-2 py-1 rounded text-xs">
                    <input
                      type="checkbox"
                      name="ids"
                      value={m.id}
                      className="accent-red-500"
                    />
                    <span>Zaznacz</span>
                  </label>

                  <div className="block group pointer-events-none">
                    <div className="relative">
                      <div className="aspect-square w-full bg-background/50 flex items-center justify-center text-xs opacity-60">
                        {m.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={m.image_url}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                        ) : (
                          <span>brak miniatury</span>
                        )}
                      </div>
                    </div>

                    <div className="p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium line-clamp-1">
                          {m.title}
                        </div>
                        <span className="text-[11px] px-2 py-1 rounded bg-background/60 border border-border">
                          {m.unit}
                        </span>
                      </div>

                      <div className="mt-1 text-sm opacity-80">
                        {Number(m.current_quantity)} /{" "}
                        {Number(m.base_quantity)} {m.unit} ({pct}%)
                      </div>

                      <div className="mt-2 h-2 rounded bg-background/60 overflow-hidden">
                        <div
                          className={`h-full ${
                            pct <= 25
                              ? "bg-red-500/70"
                              : "bg-foreground/70"
                          }`}
                          style={{
                            width: `${Math.max(0, Math.min(100, pct))}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </form>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((m) => {
            const pct =
              m.base_quantity && Number(m.base_quantity) > 0
                ? Math.round(
                    (Number(m.current_quantity) /
                      Number(m.base_quantity)) *
                      100
                  )
                : 0;

            return (
              <li
                key={m.id}
                className="rounded border border-border bg-card overflow-hidden"
              >
                <Link
                  href={`/materials/${m.id}`}
                  className="block group"
                >
                  <div className="relative">
                    <div className="aspect-square w-full bg-background/50 flex items-center justify-center text-xs opacity-60">
                      {m.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.image_url}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : (
                        <span>brak miniatury</span>
                      )}
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium line-clamp-1">
                        {m.title}
                      </div>
                      <span className="text-[11px] px-2 py-1 rounded bg-background/60 border border-border">
                        {m.unit}
                      </span>
                    </div>

                    <div className="mt-1 text-sm opacity-80">
                      {Number(m.current_quantity)} /{" "}
                      {Number(m.base_quantity)} {m.unit} ({pct}
                      %)
                    </div>

                    <div className="mt-2 h-2 rounded bg-background/60 overflow-hidden">
                      <div
                        className={`h-full ${
                          pct <= 25
                            ? "bg-red-500/70"
                            : "bg-foreground/70"
                        }`}
                        style={{
                          width: `${Math.max(0, Math.min(100, pct))}%`,
                        }}
                      />
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {/* Pager */}
      <div className="flex items-center gap-3">
        <Link
          href={mkQuery({ page: Math.max(1, page - 1) })}
          className={`border border-border px-3 py-1 rounded bg-card hover:bg-card/80 ${
            page <= 1 ? "pointer-events-none opacity-50" : ""
          }`}
          aria-disabled={page <= 1}
        >
          ← Poprzednia
        </Link>
        <span className="text-sm opacity-70">Strona {page}</span>
        <Link
          href={mkQuery({ page: page + 1 })}
          className={`border border-border px-3 py-1 rounded bg-card hover:bg-card/80 ${
            rows.length < limit
              ? "pointer-events-none opacity-50"
              : ""
          }`}
          aria-disabled={rows.length < limit}
        >
          Następna →
        </Link>
      </div>
    </div>
  );
}
