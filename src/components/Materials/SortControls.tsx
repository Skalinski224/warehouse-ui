'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

type SortKey = 'title' | 'current_quantity' | 'base_quantity' | 'created_at';
type Dir = 'asc' | 'desc';

const SORT_KEYS: SortKey[] = ['title', 'current_quantity', 'base_quantity', 'created_at'];
const DIRS: Dir[] = ['asc', 'desc'];

type Props = {
  className?: string;
  /** Ewentualna podmiana etykiet (np. i18n) */
  labels?: Partial<Record<SortKey, string>>;
};

export default function SortControls({ className = '', labels }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const currentSort = (sp.get('sort') as SortKey) ?? 'title';
  const sort: SortKey = SORT_KEYS.includes(currentSort) ? currentSort : 'title';

  const currentDir = (sp.get('dir') as Dir) ?? 'asc';
  const dir: Dir = DIRS.includes(currentDir) ? currentDir : 'asc';

  function apply(next: Partial<{ sort: SortKey; dir: Dir }>) {
    const params = new URLSearchParams(sp.toString());

    if (next.sort) params.set('sort', next.sort);
    if (next.dir) params.set('dir', next.dir);

    // reset paginacji
    params.set('page', '1');

    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className={`flex flex-wrap items-end gap-2 ${className}`}>
      <label className="text-sm flex items-center gap-2">
        Sortuj:
        <select
          value={sort}
          onChange={(e) => apply({ sort: e.target.value as SortKey })}
          className="border border-border bg-background rounded px-2 py-2"
          aria-label="Sortuj po"
        >
          {SORT_KEYS.map((key) => (
            <option key={key} value={key}>
              {labels?.[key] ??
                ({
                  title: 'Tytuł',
                  current_quantity: 'Stan',
                  base_quantity: 'Baza',
                  created_at: 'Data dodania',
                } as const)[key]}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm flex items-center gap-2">
        Kierunek:
        <select
          value={dir}
          onChange={(e) => apply({ dir: e.target.value as Dir })}
          className="border border-border bg-background rounded px-2 py-2"
          aria-label="Kierunek sortowania"
        >
          <option value="asc">Rosnąco</option>
          <option value="desc">Malejąco</option>
        </select>
      </label>
    </div>
  );
}
