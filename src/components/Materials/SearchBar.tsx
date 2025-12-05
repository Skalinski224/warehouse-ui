'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

type Props = {
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
};

/**
 * SearchBar — steruje parametrem `q` w URL.
 * - Enter / klik "Szukaj": ustawia `q` i resetuje `page=1`
 * - X (clear): usuwa `q` i ustawia `page=1`
 * - Zachowuje pozostałe query params (sort, dir, include_deleted, ...).
 */
export default function SearchBar({
  placeholder = 'Szukaj po nazwie…',
  className = '',
  autoFocus,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  // Początkowa wartość z URL
  const initial = useMemo(() => sp.get('q') ?? '', [sp]);
  const [value, setValue] = useState(initial);

  // Kiedy URL zmienia się z zewnątrz (nawigacja wstecz/klik w filtr),
  // zsynchronizuj pole z parametrem `q`
  useEffect(() => {
    const now = sp.get('q') ?? '';
    setValue(now);
  }, [sp]);

  function applyQuery(nextQ: string) {
    const params = new URLSearchParams(sp.toString());
    if (nextQ.trim()) {
      params.set('q', nextQ.trim());
    } else {
      params.delete('q');
    }
    // resetuj paginację
    params.set('page', '1');

    const url = `${pathname}?${params.toString()}`;
    router.push(url);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    applyQuery(value);
  }

  function onClear() {
    setValue('');
    applyQuery('');
  }

  return (
    <form onSubmit={onSubmit} className={`relative ${className}`}>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full border border-border bg-background rounded px-3 py-2 pr-10"
        aria-label="Wyszukaj materiały"
      />

      {/* Clear (X) */}
      {value ? (
        <button
          type="button"
          onClick={onClear}
          aria-label="Wyczyść wyszukiwanie"
          className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded hover:bg-background/60 text-foreground/70"
          title="Wyczyść"
        >
          ×
        </button>
      ) : null}

      {/* Submit (ukryty wizualnie, dostępny dla Enter/tab) */}
      <button type="submit" className="sr-only">
        Szukaj
      </button>
    </form>
  );
}
