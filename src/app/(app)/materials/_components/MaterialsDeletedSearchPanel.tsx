// src/app/(app)/materials/_components/MaterialsDeletedSearchPanel.tsx
"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type LocationOption = { id: string; label: string };

type Initial = {
  q: string;
  sort: string;
  dir: string;
  page: number;
  loc: string;
};

function buildParams(v: Initial) {
  const p = new URLSearchParams();
  if (v.q.trim()) p.set("q", v.q.trim());
  if (v.loc) p.set("loc", v.loc);
  p.set("sort", v.sort);
  p.set("dir", v.dir);
  p.set("page", String(v.page));
  return p;
}

export default function MaterialsDeletedSearchPanel({
  initial,
  locations,
}: {
  initial: Initial;
  locations: LocationOption[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [q, setQ] = useState(initial.q ?? "");
  const [loc, setLoc] = useState(initial.loc ?? "");
  const [sort, setSort] = useState(initial.sort ?? "deleted_at");
  const [dir, setDir] = useState(initial.dir ?? "desc");

  const [open, setOpen] = useState(false);

  const debounceRef = useRef<any>(null);

  function replaceNow(next?: Partial<Initial>, target?: "/materials" | "/materials/deleted") {
    const v: Initial = {
      q,
      loc,
      sort,
      dir,
      page: 1,
      ...next,
    };

    const params = buildParams(v).toString();
    startTransition(() => {
      router.replace(`${target ?? "/materials/deleted"}?${params}`);
    });
  }

  function resetAll() {
    setQ("");
    setLoc("");
    setSort("deleted_at");
    setDir("desc");
    replaceNow({ q: "", loc: "", sort: "deleted_at", dir: "desc" });
  }

  // live search (q)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => replaceNow(), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // selects apply immediately
  useEffect(() => {
    replaceNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, dir, loc]);

  // UX
  useEffect(() => {
    setOpen(false);
  }, [sort, dir, loc]);

  return (
    <div className="flex flex-col gap-3">
      {/* Search row */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Szukaj po nazwie…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full md:max-w-[520px] border border-border bg-background rounded px-3 py-2"
        />

        {/* ✅ Desktop-only "Szukaj" */}
        <button
          type="button"
          onClick={() => replaceNow()}
          className="hidden md:inline-flex shrink-0 px-3 py-2 rounded border border-border bg-card hover:bg-card/80 text-sm transition"
        >
          Szukaj
        </button>

        {/* ✅ Mobile burger */}
        <div className="md:hidden ml-auto">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="border border-border rounded px-3 py-2 bg-card hover:bg-card/80 text-sm"
            aria-label="Filtry"
          >
            ☰
          </button>
        </div>
      </div>

      {/* Desktop filters */}
      <div className="hidden md:grid col-span-2 mt-2">
        <div className="grid grid-cols-4 gap-6 w-full">
          <div className="grid gap-2">
            <div className="text-xs opacity-80">Stan</div>
            <select
              value="deleted"
              onChange={(e) => {
                const v = e.target.value;
                if (v === "active") replaceNow({}, "/materials");
              }}
              className="border border-border bg-background rounded px-2 py-2 w-full"
            >
              <option value="active">Aktywne</option>
              <option value="deleted">Usunięte</option>
            </select>
          </div>

          <div className="grid gap-2">
            <div className="text-xs opacity-80">Lokalizacja</div>
            <select
              value={loc}
              onChange={(e) => setLoc(e.target.value)}
              className="border border-border bg-background rounded px-2 py-2 w-full"
            >
              <option value="">Wszystkie</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <div className="text-xs opacity-80">Sortuj</div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="border border-border bg-background rounded px-2 py-2 w-full"
            >
              <option value="deleted_at">Data usunięcia</option>
              <option value="title">Tytuł</option>
              <option value="created_at">Data dodania</option>
            </select>
          </div>

          <div className="grid gap-2">
            <div className="text-xs opacity-80">Kierunek</div>
            <select
              value={dir}
              onChange={(e) => setDir(e.target.value)}
              className="border border-border bg-background rounded px-2 py-2 w-full"
            >
              <option value="desc">Malejąco</option>
              <option value="asc">Rosnąco</option>
            </select>
          </div>
        </div>
      </div>

      {/* ✅ Mobile filters sheet */}
      {open ? (
        <div className="fixed inset-0 z-40">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="Zamknij"
            onClick={() => setOpen(false)}
          />

          <div className="absolute right-0 top-0 h-full w-[340px] max-w-[90vw] bg-card border-l border-border shadow-2xl flex flex-col">
            <div className="p-4 border-b border-border flex items-center justify-between gap-2">
              <div className="font-semibold">Filtry</div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-3 py-2 rounded border border-border bg-card hover:bg-card/80 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto">
              <div className="grid gap-2">
                <label className="text-xs opacity-80">Stan</label>
                <select
                  value="deleted"
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "active") replaceNow({}, "/materials");
                  }}
                  className="border border-border bg-background rounded px-2 py-2"
                >
                  <option value="active">Aktywne</option>
                  <option value="deleted">Usunięte</option>
                </select>
              </div>

              <div className="grid gap-2">
                <label className="text-xs opacity-80">Lokalizacja</label>
                <select
                  value={loc}
                  onChange={(e) => setLoc(e.target.value)}
                  className="border border-border bg-background rounded px-2 py-2"
                >
                  <option value="">Wszystkie</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <label className="text-xs opacity-80">Sortuj</label>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="border border-border bg-background rounded px-2 py-2"
                >
                  <option value="deleted_at">Data usunięcia</option>
                  <option value="title">Tytuł</option>
                  <option value="created_at">Data dodania</option>
                </select>
              </div>

              <div className="grid gap-2">
                <label className="text-xs opacity-80">Kierunek</label>
                <select
                  value={dir}
                  onChange={(e) => setDir(e.target.value)}
                  className="border border-border bg-background rounded px-2 py-2"
                >
                  <option value="desc">Malejąco</option>
                  <option value="asc">Rosnąco</option>
                </select>
              </div>

              <div className="text-[11px] opacity-60">
                Filtry działają na żywo. „Zastosuj” tylko zamyka panel.
              </div>
            </div>

            <div className="p-4 border-t border-border flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={resetAll}
                className="px-3 py-2 rounded border border-border bg-background text-sm"
              >
                Wyczyść
              </button>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-3 py-2 rounded border border-border bg-card hover:bg-card/80 text-sm"
              >
                Zastosuj
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}