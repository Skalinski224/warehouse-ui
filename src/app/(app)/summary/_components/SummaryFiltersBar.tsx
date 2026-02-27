// src/app/(app)/summary/_components/SummaryFiltersBar.tsx
"use client";

import { useMemo, useState, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type LocationRow = { id: string; label: string; deleted_at?: string | null };

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function SummaryFiltersBar(props: {
  from: string;
  to: string;
  loc: string | null;
  locations: LocationRow[];

  defaultFrom: string;
  defaultTo: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [from, setFrom] = useState<string>(props.from);
  const [to, setTo] = useState<string>(props.to);
  const [loc, setLoc] = useState<string>(props.loc ?? "");

  // ✅ mobile drawer
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // gdy user zmieni query (back/forward), uaktualnij pola
    setFrom(props.from);
    setTo(props.to);
    setLoc(props.loc ?? "");
  }, [props.from, props.to, props.loc]);

  const hasChanges = from !== props.from || to !== props.to || (loc || null) !== (props.loc ?? null);

  const locationOptions = useMemo(() => {
    const rows = props.locations ?? [];
    return rows.map((r) => ({
      id: r.id,
      label: r.deleted_at ? `${r.label} (usunięta)` : r.label,
    }));
  }, [props.locations]);

  function pushNext(next: { from: string; to: string; loc: string | null }) {
    const qs = new URLSearchParams(sp.toString());
    qs.set("from", next.from);
    qs.set("to", next.to);
    if (next.loc) qs.set("loc", next.loc);
    else qs.delete("loc");
    router.push(`${pathname}?${qs.toString()}`);
  }

  function applyPreset(days: number) {
    const nextFrom = daysAgoISO(days);
    const nextTo = todayISO();
    const nextLoc = loc.trim().length > 0 ? loc.trim() : null;

    setFrom(nextFrom);
    setTo(nextTo);

    pushNext({ from: nextFrom, to: nextTo, loc: nextLoc });
    setOpen(false);
  }

  const inputBase =
    "h-10 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none " +
    "focus:ring-1 focus:ring-emerald-500/25";

  const summaryText = useMemo(() => {
    const locLabel =
      loc && loc.trim()
        ? locationOptions.find((x) => x.id === loc)?.label ?? "Wybrana"
        : "Wszystkie";
    return `${from} → ${to} • ${locLabel}`;
  }, [from, to, loc, locationOptions]);

  function resetToDefault() {
    setFrom(props.defaultFrom);
    setTo(props.defaultTo);
    setLoc("");
    pushNext({ from: props.defaultFrom, to: props.defaultTo, loc: null });
    setOpen(false);
  }

  function save() {
    const safeFrom = from || props.defaultFrom;
    const safeTo = to || props.defaultTo;
    const safeLoc = loc.trim().length > 0 ? loc.trim() : null;
    pushNext({ from: safeFrom, to: safeTo, loc: safeLoc });
    setOpen(false);
  }

  // ---------------------------
  // DESKTOP: zostaje obecny blok (prawie bez zmian)
  // ---------------------------
  const Desktop = (
    <div className="card p-4 hidden md:block">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-sm font-semibold">Filtry</div>
          <div className="text-xs text-muted-foreground">
            Domyślnie: ostatnie 30 dni. Zmień i kliknij{" "}
            <span className="font-medium text-foreground">Zapisz</span>.
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="h-9 rounded-xl border border-border bg-card px-3 text-xs hover:bg-muted"
            onClick={() => applyPreset(7)}
          >
            Ostatnie 7 dni
          </button>
          <button
            type="button"
            className="h-9 rounded-xl border border-border bg-card px-3 text-xs hover:bg-muted"
            onClick={() => applyPreset(30)}
          >
            Ostatnie 30 dni
          </button>
          <button
            type="button"
            className="h-9 rounded-xl border border-border bg-card px-3 text-xs hover:bg-muted"
            onClick={() => applyPreset(90)}
          >
            Ostatnie 90 dni
          </button>

          <button
            type="button"
            className={cls(
              "h-9 rounded-xl border px-3 text-xs font-medium transition",
              "border-red-500/45 bg-red-500/10 text-red-200 hover:bg-red-500/16"
            )}
            onClick={resetToDefault}
            title="Powrót do domyślnego zakresu (ostatnie 30 dni) i wszystkie lokalizacje"
          >
            Reset
          </button>

          <button
            type="button"
            className={cls(
              "h-9 rounded-xl border px-3 text-xs font-medium transition",
              hasChanges
                ? "border-emerald-500/50 bg-emerald-500/12 text-foreground hover:bg-emerald-500/18 ring-1 ring-emerald-500/20"
                : "border-border bg-card text-muted-foreground opacity-60"
            )}
            disabled={!hasChanges}
            onClick={save}
          >
            Zapisz
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-12 md:items-end">
        <div className="md:col-span-4">
          <div className="mb-1 text-xs text-muted-foreground">Od</div>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputBase} />
        </div>

        <div className="md:col-span-4">
          <div className="mb-1 text-xs text-muted-foreground">Do</div>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputBase} />
        </div>

        <div className="md:col-span-4">
          <div className="mb-1 text-xs text-muted-foreground">Lokalizacja</div>
          <select value={loc} onChange={(e) => setLoc(e.target.value)} className={inputBase}>
            <option value="">Wszystkie</option>
            {locationOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <style jsx>{`
        @media (min-width: 1280px) {
          .card :global(input[type="date"]),
          .card :global(select) {
            max-width: 420px;
          }
        }
      `}</style>
    </div>
  );

  // ---------------------------
  // MOBILE: przycisk + drawer z prawej
  // ---------------------------
  const Mobile = (
    <div className="md:hidden">
      {/* Kompaktowy pasek */}
      <div className="card p-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold">Filtry</div>
          <div className="text-xs text-muted-foreground truncate">{summaryText}</div>
        </div>

        <button
          type="button"
          className={cls(
            "h-9 shrink-0 rounded-xl border px-3 text-xs font-medium transition",
            "border-border bg-card hover:bg-muted/30"
          )}
          onClick={() => setOpen(true)}
        >
          Otwórz
        </button>
      </div>

      {/* Overlay */}
      {open ? (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      {/* Drawer RIGHT */}
      <div
        className={cls(
          "fixed right-0 top-0 z-50 h-full w-[92vw] max-w-[420px] transform transition",
          "border-l border-border bg-background",
          open ? "translate-x-0" : "translate-x-full"
        )}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-border px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-base font-semibold">Filtry</div>
                <div className="text-xs text-muted-foreground">Domyślnie: ostatnie 30 dni</div>
              </div>
              <button
                type="button"
                className="h-9 rounded-xl border border-border bg-card px-3 text-xs hover:bg-muted/30"
                onClick={() => setOpen(false)}
              >
                Zamknij
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="grid gap-3">
              <div>
                <div className="mb-1 text-xs text-muted-foreground">Od</div>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputBase} />
              </div>

              <div>
                <div className="mb-1 text-xs text-muted-foreground">Do</div>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputBase} />
              </div>

              <div>
                <div className="mb-1 text-xs text-muted-foreground">Lokalizacja</div>
                <select value={loc} onChange={(e) => setLoc(e.target.value)} className={inputBase}>
                  <option value="">Wszystkie</option>
                  {locationOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-2 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  className="h-10 rounded-xl border border-border bg-card text-xs hover:bg-muted/30"
                  onClick={() => applyPreset(7)}
                >
                  7 dni
                </button>
                <button
                  type="button"
                  className="h-10 rounded-xl border border-border bg-card text-xs hover:bg-muted/30"
                  onClick={() => applyPreset(30)}
                >
                  30 dni
                </button>
                <button
                  type="button"
                  className="h-10 rounded-xl border border-border bg-card text-xs hover:bg-muted/30"
                  onClick={() => applyPreset(90)}
                >
                  90 dni
                </button>
              </div>
            </div>
          </div>

          <div className="border-t border-border p-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={cls(
                  "h-10 flex-1 rounded-xl border px-3 text-xs font-medium transition",
                  "border-red-500/45 bg-red-500/10 text-red-200 hover:bg-red-500/16"
                )}
                onClick={resetToDefault}
              >
                Reset
              </button>

              <button
                type="button"
                className={cls(
                  "h-10 flex-1 rounded-xl border px-3 text-xs font-medium transition",
                  hasChanges
                    ? "border-emerald-500/50 bg-emerald-500/12 text-foreground hover:bg-emerald-500/18 ring-1 ring-emerald-500/20"
                    : "border-border bg-card text-muted-foreground opacity-60"
                )}
                disabled={!hasChanges}
                onClick={save}
              >
                Zapisz
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {Mobile}
      {Desktop}
    </>
  );
}