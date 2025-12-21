// src/components/daily-reports/DailyReportsTable.tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { DailyReportRow } from "@/lib/dto";
import type { PermissionSnapshot } from "@/lib/permissions";
import { can, PERM } from "@/lib/permissions";

/* ---------------------------------- HELPERY --------------------------------- */

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
    // do włącznie
    toDate.setHours(23, 59, 59, 999);
    if (d > toDate) return false;
  }

  return true;
}

function StatusBadge({ approved }: { approved: boolean }) {
  const label = approved ? "Zatwierdzony" : "Oczekuje";
  const dot = approved ? "bg-emerald-500" : "bg-amber-500";

  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-muted">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

function CompletedIcon({ completed }: { completed: boolean }) {
  if (!completed) {
    return (
      <span
        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border text-xs text-muted-foreground"
        title="Zadanie w toku"
      >
        …
      </span>
    );
  }

  return (
    <span
      className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-emerald-500 text-xs text-emerald-400"
      title="Zadanie zakończone"
    >
      ✓
    </span>
  );
}

/* ---------------------------------- KOMPONENT -------------------------------- */

type Props = {
  reports: DailyReportRow[];
  /** snapshot z DB (my_permissions_snapshot) */
  snapshot: PermissionSnapshot | null;
};

export default function DailyReportsTable({ reports, snapshot }: Props) {
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  // Worker nie ma oglądać po fakcie zatwierdzonych -> blokujemy wejście w szczegóły dla approved.
  const isWorker = snapshot?.role === "worker";
  const canRead = can(snapshot, PERM.DAILY_REPORTS_READ);

  const filteredReports = useMemo(() => {
    const q = search.trim().toLowerCase();

    return reports
      .filter((r) => isWithinRange(r.date, fromDate, toDate))
      .filter((r) => {
        if (!q) return true;

        const haystack = [r.crewName ?? "", r.person ?? "", r.location ?? ""]
          .join(" ")
          .toLowerCase();

        return haystack.includes(q);
      });
  }, [reports, fromDate, toDate, search]);

  // układ kolumn jak w tabeli (desktop)
  const gridCols =
    "grid-cols-[180px_minmax(180px,1fr)_minmax(140px,1fr)_minmax(140px,1fr)_140px_90px_110px]";

  function RowShell({
    canEnter,
    href,
    children,
  }: {
    canEnter: boolean;
    href: string;
    children: React.ReactNode;
  }) {
    const base =
      "block rounded-2xl border border-border bg-background/20 px-4 py-3 transition";
    const hover =
      "hover:bg-background/35 hover:border-border/90 focus:outline-none focus:ring-2 focus:ring-foreground/40";
    const disabled =
      "opacity-60 cursor-not-allowed hover:bg-background/20";

    if (!canEnter) {
      return <div className={`${base} ${disabled}`}>{children}</div>;
    }

    return (
      <Link href={href} className={`${base} ${hover}`}>
        {children}
      </Link>
    );
  }

  return (
    <div className="space-y-3">
      {/* FILTRY (zostawiam układ jak masz — działa i jest czytelnie) */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-wrap gap-4">
          {/* Zakres dat */}
          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground">
              Zakres dat
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-8 rounded-md border border-border bg-background px-2 text-xs"
              />
              <span className="text-xs text-muted-foreground">–</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-8 rounded-md border border-border bg-background px-2 text-xs"
              />
            </div>
          </div>

          {/* Szukajka */}
          <div className="space-y-1 min-w-[220px]">
            <div className="text-xs font-medium text-muted-foreground">
              Szukaj (brygada, osoba, miejsce)
            </div>
            <input
              type="text"
              placeholder="Wpisz frazę…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
            />
          </div>
        </div>

        {/* Licznik */}
        <div className="text-xs text-muted-foreground">
          Pokazano <span className="font-medium">{filteredReports.length}</span> z{" "}
          <span className="font-medium">{reports.length}</span> raportów
        </div>
      </div>

      {/* LISTA W KARCIE (jak na screenie) */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {filteredReports.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">
            Brak raportów spełniających kryteria.
          </div>
        ) : (
          <div className="p-3 space-y-3">
            {/* Nagłówki kolumn (zachowujemy układ informacji) */}
            <div
              className={[
                "hidden md:grid",
                gridCols,
                "px-4 py-2 rounded-xl border border-border bg-muted/30",
                "text-xs font-medium text-muted-foreground uppercase tracking-wide",
              ].join(" ")}
            >
              <div>Data</div>
              <div>Brygada</div>
              <div>Osoba</div>
              <div>Miejsce</div>
              <div>Status</div>
              <div className="text-center">Zadanie</div>
              <div className="text-right">Akcje</div>
            </div>

            {/* Pozycje */}
            <div className="space-y-2">
              {filteredReports.map((report) => {
                // worker: approved -> nie wolno wejść
                const canEnter = canRead && (!isWorker || report.approved === false);
                const href = `/reports/daily/${report.id}`;

                return (
                  <RowShell
                    key={report.id}
                    canEnter={canEnter}
                    href={href}
                  >
                    {/* Desktop: 1 wiersz w gridzie jak tabela */}
                    <div className={["hidden md:grid", gridCols, "items-center gap-3"].join(" ")}>
                      {/* Data */}
                      <div className="whitespace-nowrap">
                        <div className="text-sm font-medium">{formatDate(report.date)}</div>
                        <div className="text-xs text-muted-foreground">
                          {report.createdAt ? `utw. ${formatDate(report.createdAt)}` : null}
                        </div>
                      </div>

                      {/* Brygada */}
                      <div className="text-sm font-medium">{report.crewName || "—"}</div>

                      {/* Osoba */}
                      <div className="text-sm">{report.person || "—"}</div>

                      {/* Miejsce */}
                      <div className="text-sm">
                        {report.location || (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>

                      {/* Status */}
                      <div>
                        <StatusBadge approved={report.approved} />
                      </div>

                      {/* Zadanie */}
                      <div className="text-center">
                        <CompletedIcon completed={report.isCompleted} />
                      </div>

                      {/* Akcje */}
                      <div className="text-right">
                        {canEnter ? (
                          <span className="text-xs font-medium text-primary">
                            Szczegóły
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </div>

                    {/* Mobile: stack (bez psucia czytelności) */}
                    <div className="md:hidden space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium">
                            {formatDate(report.date)}
                          </div>
                          <div className="text-xs opacity-70">
                            {report.crewName || "—"} · {report.person || "—"}
                          </div>
                          <div className="text-xs opacity-70">
                            {report.location || "—"}
                          </div>
                        </div>

                        <div className="shrink-0 flex flex-col items-end gap-2">
                          <StatusBadge approved={report.approved} />
                          <CompletedIcon completed={report.isCompleted} />
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs opacity-70">
                        <span>
                          {report.createdAt ? `utw. ${formatDate(report.createdAt)}` : ""}
                        </span>
                        <span className="font-medium">
                          {canEnter ? "Szczegóły →" : "Brak dostępu"}
                        </span>
                      </div>
                    </div>
                  </RowShell>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
