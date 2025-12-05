// src/app/(app)/materials/deleted/page.tsx
import Link from "next/link";
import { supabaseServer } from "@/lib/supabaseServer";
import { restoreMaterial } from "@/lib/actions";

type Material = {
  id: string;
  title: string;
  unit: string;
  base_quantity: number;
  current_quantity: number;
  image_url: string | null;
  deleted_at: string | null;
  created_at: string;
};

function sp(o: { [k: string]: string | string[] | undefined }, k: string) {
  const v = o?.[k];
  return Array.isArray(v) ? v[0] : v;
}

const SORT_KEYS = ["deleted_at", "title", "created_at"] as const;
type SortKey = (typeof SORT_KEYS)[number];
const DIRS = ["asc", "desc"] as const;
type Dir = (typeof DIRS)[number];

/** Akcja: restore pojedynczego materiału */
async function doRestore(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  if (id) await restoreMaterial(id);
}

export default async function DeletedMaterialsPage({
  searchParams = {},
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const sb = await supabaseServer();

  const qRaw = sp(searchParams, "q");
  const q = (qRaw ?? "").trim();

  const sortRaw = (sp(searchParams, "sort") ?? "deleted_at") as SortKey;
  const sort: SortKey = (SORT_KEYS as readonly string[]).includes(sortRaw) ? sortRaw : "deleted_at";

  const dirRaw = (sp(searchParams, "dir") ?? "desc") as Dir;
  const dir: Dir = (DIRS as readonly string[]).includes(dirRaw) ? dirRaw : "desc";

  const page = Math.max(1, Number(sp(searchParams, "page") ?? 1));
  const limit = 30;
  const offset = (page - 1) * limit;

  // SELECT tylko usunięte (deleted_at IS NOT NULL), z opcjonalnym ilike po tytule
  let query = sb
    .from("materials")
    .select("id,title,unit,base_quantity,current_quantity,image_url,deleted_at,created_at", { count: "exact" })
    .not("deleted_at", "is", null);

  if (q) query = query.ilike("title", `%${q}%`);

  // sort
  query = query.order(sort, { ascending: dir === "asc", nullsFirst: sort !== "deleted_at" });

  // paginacja przez range
  const { data, error, count } = await query.range(offset, offset + limit - 1);

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-4">Usunięte materiały</h1>
        <pre className="text-red-400 text-sm whitespace-pre-wrap">DB error: {error.message}</pre>
      </div>
    );
  }

  const rows = (data ?? []) as Material[];
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / limit));

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
      {/* Header / nav */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Usunięte materiały</h1>
        <Link href="/materials" className="text-sm text-foreground/80 hover:underline">
          ← Wróć do katalogu
        </Link>
      </div>

      {/* Toolbar: szukaj + sort */}
      <div className="flex flex-wrap items-end gap-3">
        <form method="GET" className="flex-1 min-w-[260px] md:max-w-[33%]">
          <div className="flex gap-2">
            <input
              type="text"
              name="q"
              placeholder="Szukaj po nazwie…"
              defaultValue={q}
              className="w-full border border-border bg-background rounded px-3 py-2"
            />
            <input type="hidden" name="sort" value={sort} />
            <input type="hidden" name="dir" value={dir} />
            <input type="hidden" name="page" value="1" />
            <button className="border border-border rounded px-3 py-2 bg-card hover:bg-card/80">
              Szukaj
            </button>
          </div>
        </form>

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

      {/* Lista usuniętych */}
      {rows.length === 0 ? (
        <div className="border border-dashed border-border rounded p-8 text-center text-sm opacity-75">
          Brak usuniętych materiałów.
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((m) => (
            <li key={m.id} className="rounded border border-border bg-card overflow-hidden">
              <div className="relative">
                <div className="aspect-square w-full bg-background/50 flex items-center justify-center text-xs opacity-60">
                  {m.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span>brak miniatury</span>
                  )}
                </div>
                <div className="absolute top-2 right-2 text-[11px] px-2 py-1 rounded bg-red-500/20 border border-red-500/30 text-red-200">
                  usunięty
                </div>
              </div>

              <div className="p-4 opacity-90">
                <div className="font-medium line-clamp-1">{m.title}</div>
                <div className="text-sm opacity-80 mt-1">
                  Stan w momencie podglądu: {Number(m.current_quantity)} / {Number(m.base_quantity)} {m.unit}
                </div>
                <div className="text-xs opacity-70 mt-1">
                  Usunięto: {m.deleted_at ? new Date(m.deleted_at).toLocaleString() : "-"}
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <Link
                    href={`/materials/${m.id}`}
                    className="text-xs text-foreground/80 hover:underline"
                  >
                    Szczegóły
                  </Link>
                  <form action={doRestore}>
                    <input type="hidden" name="id" value={m.id} />
                    <button className="px-3 py-2 rounded border border-border bg-green-600/20 hover:bg-green-600/30 text-green-100 text-sm">
                      Przywróć
                    </button>
                  </form>
                </div>
              </div>
            </li>
          ))}
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
        <span className="text-sm opacity-70">
          Strona {page} / {pages}
        </span>
        <Link
          href={mkQuery({ page: Math.min(pages, page + 1) })}
          className={`border border-border px-3 py-1 rounded bg-card hover:bg-card/80 ${
            page >= pages ? "pointer-events-none opacity-50" : ""
          }`}
          aria-disabled={page >= pages}
        >
          Następna →
        </Link>
      </div>
    </div>
  );
}
