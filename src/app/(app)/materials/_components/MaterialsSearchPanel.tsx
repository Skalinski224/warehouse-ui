// src/app/(app)/materials/_components/MaterialsSearchPanel.tsx
"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";

type LocationOption = { id: string; label: string };

type Initial = {
  q: string;
  sort: string;
  dir: string;
  loc: string;
  state: "active" | "deleted";
  page: number;
  multi: "" | "1";
};

function buildParams(v: Initial) {
  const p = new URLSearchParams();
  if (v.q.trim()) p.set("q", v.q.trim());
  p.set("sort", v.sort);
  p.set("dir", v.dir);
  if (v.loc) p.set("loc", v.loc);
  p.set("state", v.state);
  if (v.multi === "1") p.set("multi", "1");
  p.set("page", String(v.page));
  return p;
}

export default function MaterialsSearchPanel({
  canSoftDelete,
  locations,
  initial,
}: {
  canSoftDelete: boolean;
  locations: LocationOption[];
  initial: Initial;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  const [q, setQ] = useState(initial.q ?? "");
  const [sort, setSort] = useState(initial.sort ?? "title");
  const [dir, setDir] = useState(initial.dir ?? "asc");
  const [loc, setLoc] = useState(initial.loc ?? "");
  const [state, setState] = useState<"active" | "deleted">(initial.state ?? "active");

  // mobile sheet
  const [open, setOpen] = useState(false);

  const debounceRef = useRef<any>(null);

  const targetBase = useMemo(() => {
    const wantDeleted = state === "deleted" && canSoftDelete;
    return wantDeleted ? "/materials/deleted" : "/materials";
  }, [state, canSoftDelete]);

  function pushNow(next: Partial<Initial>) {
    const v: Initial = {
      q,
      sort,
      dir,
      loc,
      state,
      page: 1,
      multi: initial.multi,
      ...next,
    };

    if (v.state === "deleted" && !canSoftDelete) v.state = "active";

    const params = buildParams(v).toString();

    startTransition(() => {
      router.replace(`${targetBase}?${params}`);
    });
  }

  function resetAll() {
    setQ("");
    setSort("title");
    setDir("asc");
    setLoc("");
    setState("active");
    // live i tak zadziała, ale dopchniemy natychmiast:
    pushNow({ q: "", sort: "title", dir: "asc", loc: "", state: "active" });
  }

  // live search debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => pushNow({}), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // selects: od razu
  useEffect(() => {
    pushNow({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, dir, loc, state]);

  // jeśli jesteśmy na /materials/deleted i user nie ma perm -> wróć
  useEffect(() => {
    if (pathname === "/materials/deleted" && !canSoftDelete) {
      setState("active");
      setOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, canSoftDelete]);

  // mobile: zamknij sheet przy zmianie trasy (UX)
  useEffect(() => {
    setOpen(false);
  }, [targetBase]);

  return (
    <div className="flex flex-col gap-3">
      {/* Search row */}
      <div className="flex items-center gap-2">
        <input
          id="materialsSearchInput"
          type="text"
          placeholder="Szukaj po nazwie…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full md:max-w-[520px] border border-border bg-background rounded px-3 py-2"
        />

        {/* ✅ Desktop-only "Szukaj" */}
        <button
          type="button"
          onClick={() => pushNow({})}
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
              value={state}
              onChange={(e) => setState(e.target.value as any)}
              className="border border-border bg-background rounded px-2 py-2 w-full"
            >
              <option value="active">Aktywne</option>
              {canSoftDelete ? <option value="deleted">Usunięte</option> : null}
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
              <option value="title">Tytuł</option>
              <option value="current_quantity">Stan</option>
              <option value="base_quantity">Baza</option>
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
              <option value="asc">Rosnąco</option>
              <option value="desc">Malejąco</option>
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
                  value={state}
                  onChange={(e) => setState(e.target.value as any)}
                  className="border border-border bg-background rounded px-2 py-2"
                >
                  <option value="active">Aktywne</option>
                  {canSoftDelete ? <option value="deleted">Usunięte</option> : null}
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
                  <option value="title">Tytuł</option>
                  <option value="current_quantity">Stan</option>
                  <option value="base_quantity">Baza</option>
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
                  <option value="asc">Rosnąco</option>
                  <option value="desc">Malejąco</option>
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