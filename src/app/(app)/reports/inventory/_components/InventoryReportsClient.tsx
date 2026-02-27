// src/app/(app)/reports/inventory/_components/InventoryReportsClient.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import InventoryReportsFilters from "@/app/(app)/reports/inventory/_components/InventoryReportsFilters";

/* ---------------------------------- TYPES --------------------------------- */

export type InventoryReportRow = {
  id: string;
  account_id?: string | null;

  person?: string | null;
  session_date?: string | null;

  inventory_location_label?: string | null;
  description?: string | null;

  items_count?: number | string | null;
};

type Props = {
  rows: InventoryReportRow[];
  error: string | null;

  initialFrom: string;
  initialTo: string;
  initialQ: string;
};

/* ---------------------------------- UI HELPERS (KANON) --------------------------------- */

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function Pill({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "ok" | "warn" | "bad";
  className?: string;
}) {
  const base =
    "inline-flex items-center gap-1 text-[12px] leading-none px-2.5 py-1 rounded-full border whitespace-nowrap";
  const toneCls =
    tone === "ok"
      ? "border-emerald-500/40 bg-emerald-600/10 text-emerald-200"
      : tone === "warn"
      ? "border-amber-500/40 bg-amber-600/10 text-amber-200"
      : tone === "bad"
      ? "border-red-500/40 bg-red-600/10 text-red-200"
      : "border-border bg-background/30 text-foreground/80";

  return <span className={cls(base, toneCls, className)}>{children}</span>;
}

function Kpi({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  tone?: "neutral" | "ok" | "warn" | "bad";
}) {
  const toneCls =
    tone === "ok"
      ? "bg-emerald-600/10 border-emerald-500/30"
      : tone === "warn"
      ? "bg-amber-600/10 border-amber-500/30"
      : tone === "bad"
      ? "bg-red-600/10 border-red-500/30"
      : "bg-background/20 border-border";

  return (
    <div className={cls("rounded-xl border px-3 py-2", toneCls)}>
      <div className="text-[11px] opacity-70">{label}</div>
      <div className="text-sm font-semibold leading-tight">{value}</div>
    </div>
  );
}

/* ---------------------------------- HELPERS --------------------------------- */

function toNum(v: number | string | null | undefined): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("pl-PL");
}

function mkUrl(params: { from: string; to: string; q: string }) {
  const p = new URLSearchParams();
  if (params.from.trim()) p.set("from", params.from.trim());
  if (params.to.trim()) p.set("to", params.to.trim());
  if (params.q.trim()) p.set("q", params.q.trim());
  const qs = p.toString();
  return qs ? `/reports/inventory?${qs}` : `/reports/inventory`;
}

/* ---------------------------------- VIEW --------------------------------- */

export default function InventoryReportsClient({
  rows,
  error,
  initialFrom,
  initialTo,
  initialQ,
}: Props) {
  const router = useRouter();

  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [q, setQ] = useState(initialQ);

  // sync po nawigacji (back/forward / router.replace)
  useEffect(() => setFrom(initialFrom), [initialFrom]);
  useEffect(() => setTo(initialTo), [initialTo]);
  useEffect(() => setQ(initialQ), [initialQ]);

  // drawer mobile (kanon)
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    if (!filtersOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFiltersOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtersOpen]);

  useEffect(() => {
    if (!filtersOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [filtersOpen]);

  // URL live update (debounce)
  const debounceRef = useRef<number | null>(null);
  const lastUrlRef = useRef<string>("");

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);

    debounceRef.current = window.setTimeout(() => {
      const nextUrl = mkUrl({ from, to, q });
      if (lastUrlRef.current !== nextUrl) {
        lastUrlRef.current = nextUrl;
        router.replace(nextUrl, { scroll: false });
      }
    }, 250);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [from, to, q, router]);

  const btnBase =
    "inline-flex items-center justify-center h-9 px-3 rounded-lg border text-sm transition " +
    "focus:outline-none focus:ring-2 focus:ring-foreground/30 disabled:opacity-50 disabled:pointer-events-none";

  const btnGhost = cls(btnBase, "border-border bg-background/20 hover:bg-background/35");
  const btnPrimary = cls(
    btnBase,
    "border-emerald-500/35 bg-emerald-600/15 text-emerald-200 hover:bg-emerald-600/22"
  );
  const btnDetails = cls(
    btnBase,
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/14"
  );

  const clearAll = () => {
    setFrom("");
    setTo("");
    setQ("");
  };

  const count = rows.length;

  const totalItems = useMemo(
    () => rows.reduce((acc, r) => acc + toNum(r.items_count), 0),
    [rows]
  );

  return (
    <main className="space-y-4">
      {/* KPI desktop (kanon) */}
      <div className="hidden md:grid grid-cols-3 gap-2">
        <Kpi label="Wynik" value={count} />
        <Kpi label="Suma pozycji" value={totalItems} tone="ok" />
        <Kpi label="Status" value="zatwierdzone" tone="ok" />
      </div>

      <section className="rounded-2xl border border-border bg-card overflow-hidden">
        {/* ERROR jak deliveries */}
        {error && (
          <div className="p-3 md:p-4 border-b border-border">
            <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
              Błąd ładowania inwentaryzacji: {error}
            </div>
          </div>
        )}

        {/* TOP BAR (kanon) */}
        <div className="p-3 md:p-4 border-b border-border bg-background/10">
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Szukaj: kto / opis / lokalizacja…"
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
              />
            </div>

            <button
              type="button"
              className={cls("md:hidden", btnGhost, "h-10")}
              onClick={() => setFiltersOpen(true)}
            >
              Filtry <span className="opacity-70">☰</span>
            </button>
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px] opacity-70">
            <span>Wyników: {count} (max 200)</span>
            <span className="md:hidden">Pozycji: {totalItems}</span>
          </div>
        </div>

        {/* DESKTOP: filtry */}
        <div className="hidden md:block p-3 md:p-4 border-b border-border bg-background/5">
          <InventoryReportsFilters
            from={from}
            to={to}
            q={q}
            onChangeFrom={setFrom}
            onChangeTo={setTo}
            onChangeQ={setQ}
            onClear={clearAll}
            btnGhostClass={btnGhost}
          />
        </div>

        {/* LISTA */}
        <div className="p-3 md:p-4 space-y-3">
          {!error && count === 0 && (
            <div className="rounded-2xl border border-border bg-background/20 p-4 text-sm opacity-70">
              Brak wyników — zmień filtry.
            </div>
          )}

          {rows.map((r) => {
            const href = `/reports/inventory/${r.id}`;

            const loc = r.inventory_location_label?.trim() ? r.inventory_location_label : "—";
            const who = r.person?.trim() ? r.person : "—";
            const when = fmtDate(r.session_date);
            const desc = r.description?.trim() ? r.description : null;

            const itemsCount = toNum(r.items_count);

            return (
              <Link
                key={r.id}
                href={href}
                className={cls(
                  "block rounded-2xl border border-border bg-background/10 p-4",
                  "hover:bg-background/18 hover:border-border/90 transition",
                  "focus:outline-none focus:ring-2 focus:ring-foreground/30"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="min-w-0">
                        <div className="text-[11px] uppercase tracking-wide opacity-60">
                          Lokalizacja
                        </div>
                        <div className="text-sm font-semibold truncate">{loc}</div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <Pill tone="ok">Zatwierdzona</Pill>
                        <Pill tone="ok">Pozycji: {itemsCount}</Pill>
                      </div>
                    </div>

                    <div className="mt-2 grid gap-1 text-xs opacity-80">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="opacity-60">Kto:</span>
                        <span className="font-medium">{who}</span>
                        <span className="opacity-50">•</span>
                        <span className="opacity-60">Kiedy:</span>
                        <span className="font-medium">{when}</span>
                      </div>

                      {desc ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="opacity-60">Opis:</span>
                          <span className="font-medium">{desc}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="hidden md:flex flex-col items-end gap-2 shrink-0">
                    <span className={cls(btnDetails, "px-3")}>Szczegóły →</span>
                  </div>
                </div>

                <div className="mt-4 md:hidden flex items-center gap-2 flex-wrap justify-end">
                  <span className={cls(btnDetails, "px-3")}>Szczegóły →</span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* MOBILE DRAWER (kanon) */}
      {filtersOpen && (
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/60" onClick={() => setFiltersOpen(false)} />

          <div
            className={cls(
              "absolute top-0 right-0 h-full w-[min(420px,100%)]",
              "bg-card border-l border-border shadow-2xl",
              "overflow-y-auto",
              "translate-x-0 animate-[inventoryFilterSlideIn_.18s_ease-out]"
            )}
          >
            <div className="flex items-center justify-between p-4 border-b border-border bg-background/10">
              <div className="text-base font-semibold">Filtry</div>
              <button
                type="button"
                className={cls(btnGhost, "h-9 w-9 px-0")}
                onClick={() => setFiltersOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid gap-3">
                <label className="grid gap-1">
                  <span className="text-xs opacity-70">Szukaj</span>
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="kto / opis / lokalizacja…"
                    className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                    autoFocus
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-1">
                    <span className="text-xs opacity-70">Od</span>
                    <input
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                      type="date"
                      className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs opacity-70">Do</span>
                    <input
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                      type="date"
                      className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                    />
                  </label>
                </div>

                <div className="text-xs opacity-60">
                  Filtry działają na żywo. „Zastosuj” tylko zamyka panel.
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-border bg-background/10 flex items-center justify-between gap-2">
              <button type="button" className={btnGhost} onClick={clearAll}>
                Wyczyść
              </button>

              <button type="button" className={btnPrimary} onClick={() => setFiltersOpen(false)}>
                Zastosuj
              </button>
            </div>
          </div>

          <style jsx>{`
            @keyframes inventoryFilterSlideIn_ {
              from {
                transform: translateX(28px);
                opacity: 0;
              }
              to {
                transform: translateX(0);
                opacity: 1;
              }
            }
          `}</style>
        </div>
      )}
    </main>
  );
}