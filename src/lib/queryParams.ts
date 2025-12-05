// src/lib/queryParams.ts

export type SortKey = 'title' | 'current_quantity' | 'base_quantity' | 'created_at';
export type SortDir = 'asc' | 'desc';

export const SORT_KEYS: SortKey[] = ['title', 'current_quantity', 'base_quantity', 'created_at'];
export const SORT_DIRS: SortDir[] = ['asc', 'desc'];

export type NextSearchParams =
  | URLSearchParams
  | { [key: string]: string | string[] | undefined };

export type MaterialListQuery = {
  q: string | null;
  sort: SortKey;
  dir: SortDir;
  include_deleted: boolean;
  page: number;   // 1-based
  limit: number;  // default 30
  offset: number; // derived
};

/* --------------------------------- helpers --------------------------------- */

function getFirst(sp: NextSearchParams, key: string): string | undefined {
  if (sp instanceof URLSearchParams) {
    const v = sp.get(key);
    return v === null ? undefined : v;
  }
  const v = (sp as any)?.[key];
  return Array.isArray(v) ? v[0] : v;
}

function parseBool(v: string | undefined, fallback = false): boolean {
  if (v === undefined) return fallback;
  const s = v.toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}

function parseIntSafe(v: string | undefined, fallback: number): number {
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function asSortKey(v: string | undefined, fallback: SortKey): SortKey {
  return SORT_KEYS.includes(v as SortKey) ? (v as SortKey) : fallback;
}

function asSortDir(v: string | undefined, fallback: SortDir): SortDir {
  return SORT_DIRS.includes(v as SortDir) ? (v as SortDir) : fallback;
}

/* ------------------------------ main parsing ------------------------------- */

export function parseMaterialListQuery(
  searchParams: NextSearchParams,
  defaults: Partial<Pick<MaterialListQuery, 'limit' | 'sort' | 'dir'>> = {}
): MaterialListQuery {
  const qRaw = getFirst(searchParams, 'q')?.trim();
  const q = qRaw ? qRaw : null;

  const sort = asSortKey(getFirst(searchParams, 'sort'), defaults.sort ?? 'title');
  const dir = asSortDir(getFirst(searchParams, 'dir'), defaults.dir ?? 'asc');
  const include_deleted = parseBool(getFirst(searchParams, 'include_deleted'), false);

  const page = parseIntSafe(getFirst(searchParams, 'page'), 1);
  const limit = defaults.limit ?? 30;
  const offset = (page - 1) * limit;

  return { q, sort, dir, include_deleted, page, limit, offset };
}

/* ----------------------------- query builders ------------------------------ */

export type QueryOverrides = Partial<
  Omit<MaterialListQuery, 'limit' | 'offset'> & { limit?: number }
>;

/** Buduje URLSearchParams na podstawie stanu + nadpisań (bez `offset`) */
export function buildSearchParams(
  state: MaterialListQuery,
  overrides: QueryOverrides = {}
): URLSearchParams {
  const s = new URLSearchParams();

  const q = overrides.q !== undefined ? overrides.q : state.q;
  const sort = overrides.sort ?? state.sort;
  const dir = overrides.dir ?? state.dir;
  const include_deleted =
    overrides.include_deleted !== undefined ? overrides.include_deleted : state.include_deleted;
  const page = overrides.page ?? state.page;

  if (q) s.set('q', q);
  if (sort) s.set('sort', sort);
  if (dir) s.set('dir', dir);
  if (include_deleted) s.set('include_deleted', 'true');
  s.set('page', String(page));

  return s;
}

/** Szybki helper: zbuduj link z bazą (np. '/materials') */
export function buildListHref(
  basePath: string,
  state: MaterialListQuery,
  overrides: QueryOverrides = {}
): string {
  const qp = buildSearchParams(state, overrides);
  const qs = qp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
