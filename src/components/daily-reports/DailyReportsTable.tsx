// src/components/daily-reports/DailyReportsTable.tsx
"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import Link from "next/link";
import type { DailyReportRow } from "@/lib/dto";
import type { PermissionSnapshot } from "@/lib/permissions";
import { can, PERM } from "@/lib/permissions";

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function formatDate(date: string) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("pl-PL");
}

function isWithinRange(dateStr: string, from: string, to: string) {
  if (!from && !to) return true;

  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;

  if (from) {
    const fromDate = new Date(from);
    if (d < fromDate) return false;
  }

  if (to) {
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    if (d > toDate) return false;
  }

  return true;
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

function StatusPill({ approved }: { approved: boolean }) {
  return <Pill tone={approved ? "ok" : "warn"}>{approved ? "Zatwierdzony" : "Oczekuje"}</Pill>;
}

function TaskPill({ completed }: { completed: boolean }) {
  return (
    <Pill tone={completed ? "ok" : "warn"}>
      {completed ? "Zadanie: zakończone" : "Zadanie: w toku"}
    </Pill>
  );
}

type Props = {
  reports: DailyReportRow[];
  snapshot: PermissionSnapshot | null;
};

export default function DailyReportsTable({ reports, snapshot }: Props) {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [inventoryLocation, setInventoryLocation] = useState("");
  const [search, setSearch] = useState("");

  // mobile: drawer filtrów
  const [filtersOpen, setFiltersOpen] = useState(false);

  // UX: ESC zamyka drawer
  useEffect(() => {
    if (!filtersOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFiltersOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtersOpen]);

  // UX: blokada scrolla tła gdy drawer otwarty
  useEffect(() => {
    if (!filtersOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [filtersOpen]);

  const isWorker = snapshot?.role === "worker";
  const canRead = can(snapshot, PERM.DAILY_REPORTS_READ);

  const debounceRef = useRef<number | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [debouncedInvLoc, setDebouncedInvLoc] = useState(inventoryLocation);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      setDebouncedSearch(search);
      setDebouncedInvLoc(inventoryLocation);
    }, 150);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [search, inventoryLocation]);

  const filteredReports = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    const locQ = debouncedInvLoc.trim().toLowerCase();

    return reports
      .filter((r) => isWithinRange(r.date, fromDate, toDate))
      .filter((r) => {
        if (!locQ) return true;
        const label = (r.inventoryLocationLabel ?? "").toLowerCase();
        return label.includes(locQ);
      })
      .filter((r) => {
        if (!q) return true;

        const haystack = [
          r.crewName ?? "",
          r.person ?? "",
          r.inventoryLocationLabel ?? "",
          r.location ?? "",
          r.place ?? "",
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(q);
      });
  }, [reports, fromDate, toDate, debouncedSearch, debouncedInvLoc]);

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
    setFromDate("");
    setToDate("");
    setInventoryLocation("");
    setSearch("");
  };

  function RowShell({
    canEnter,
    href,
    children,
  }: {
    canEnter: boolean;
    href: string;
    children: React.ReactNode;
  }) {
    const base = "block rounded-2xl border border-border bg-background/10 p-4 transition";
    const hover =
      "hover:bg-background/18 hover:border-border/90 focus:outline-none focus:ring-2 focus:ring-foreground/30";
    const disabled = "opacity-60 cursor-not-allowed hover:bg-background/10";

    if (!canEnter) return <div className={cls(base, disabled)}>{children}</div>;
    return (
      <Link href={href} className={cls(base, hover)}>
        {children}
      </Link>
    );
  }

  return (
    <div className="rounded-2xl border border-border overflow-hidden bg-card">
      {/* TOP BAR */}
      <div className="p-3 md:p-4 border-b border-border bg-background/10">
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Szukaj: brygada / osoba / lokalizacja / miejsce…"
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
          <span>
            Pokazano <span className="font-medium">{filteredReports.length}</span> z{" "}
            <span className="font-medium">{reports.length}</span>
          </span>
          <span className="hidden md:inline">Live</span>
        </div>
      </div>

      {/* DESKTOP FILTERS */}
      <div className="hidden md:block p-3 md:p-4 border-b border-border bg-background/5">
        <div className="grid gap-3 md:grid-cols-12">
          <label className="grid gap-1 md:col-span-3">
            <span className="text-xs opacity-70">Od</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
            />
          </label>

          <label className="grid gap-1 md:col-span-3">
            <span className="text-xs opacity-70">Do</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
            />
          </label>

          <label className="grid gap-1 md:col-span-4">
            <span className="text-xs opacity-70">Lokalizacja (magazyn)</span>
            <input
              value={inventoryLocation}
              onChange={(e) => setInventoryLocation(e.target.value)}
              placeholder="np. Magazyn / Lewe skrzydło…"
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
            />
          </label>

          <div className="md:col-span-2 flex items-end justify-end pr-1">
            <button type="button" className={cls(btnGhost, "mr-1")} onClick={clearAll}>
              Wyczyść
            </button>
          </div>
        </div>
      </div>

      {/* LIST */}
      <div className="p-3 md:p-4 space-y-3">
        {filteredReports.length === 0 ? (
          <div className="rounded-2xl border border-border bg-background/20 p-4 text-sm opacity-70">
            Brak raportów spełniających kryteria.
          </div>
        ) : (
          filteredReports.map((report) => {
            // uwaga: w /reports/daily pokazujemy tylko approved
            const canEnter = canRead && (!isWorker || report.approved === false);
            const href = `/reports/daily/${report.id}`;

            const invLoc = report.inventoryLocationLabel || "—";
            const place = report.place || report.location || "—";
            const who = report.person || "—";
            const crew = report.crewName || "—";
            const when = formatDate(report.date);

            return (
              <RowShell key={report.id} canEnter={canEnter} href={href}>
                <div className="flex items-start justify-between gap-3">
                  {/* LEFT */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="min-w-0">
                        <div className="text-[11px] uppercase tracking-wide opacity-60">
                          Lokalizacja magazynowa
                        </div>
                        <div className="text-sm font-semibold truncate">{invLoc}</div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusPill approved={report.approved} />
                        <TaskPill completed={!!report.isCompleted} />
                      </div>
                    </div>

                    <div className="mt-2 grid gap-1 text-xs opacity-80">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="opacity-60">Data:</span>
                        <span className="font-medium">{when}</span>
                        <span className="opacity-50">•</span>
                        <span className="opacity-60">Brygada:</span>
                        <span className="font-medium">{crew}</span>
                        <span className="opacity-50">•</span>
                        <span className="opacity-60">Osoba:</span>
                        <span className="font-medium">{who}</span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="opacity-60">Miejsce:</span>
                        <span className="font-medium truncate">{place}</span>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT */}
                  <div className="hidden md:flex items-center gap-2 flex-wrap justify-end shrink-0">
                    <span className={cls(canEnter ? btnDetails : btnGhost, "px-3")}>
                      {canEnter ? "Szczegóły →" : "Brak dostępu"}
                    </span>
                  </div>
                </div>

                {/* MOBILE ACTION */}
                <div className="mt-4 md:hidden flex items-center justify-end">
                  <span className={cls(canEnter ? btnDetails : btnGhost, "px-3")}>
                    {canEnter ? "Szczegóły →" : "Brak dostępu"}
                  </span>
                </div>
              </RowShell>
            );
          })
        )}
      </div>

      {/* MOBILE: DRAWER FILTERS */}
      {filtersOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setFiltersOpen(false)} />

          <div
            className={cls(
              "absolute top-0 right-0 h-full w-[min(420px,100%)]",
              "bg-card border-l border-border shadow-2xl",
              "overflow-y-auto",
              "translate-x-0 animate-[dailyFilterSlideIn_.18s_ease-out]"
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
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="brygada / osoba / lokalizacja / miejsce…"
                    className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                    autoFocus
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-1">
                    <span className="text-xs opacity-70">Od</span>
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs opacity-70">Do</span>
                    <input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                    />
                  </label>
                </div>

                <label className="grid gap-1">
                  <span className="text-xs opacity-70">Lokalizacja (magazyn)</span>
                  <input
                    value={inventoryLocation}
                    onChange={(e) => setInventoryLocation(e.target.value)}
                    placeholder="np. Magazyn / Lewe skrzydło…"
                    className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  />
                </label>

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
            @keyframes dailyFilterSlideIn_ {
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
    </div>
  );
}