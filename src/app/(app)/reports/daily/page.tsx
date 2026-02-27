// src/app/(app)/reports/daily/page.tsx
import { fetchDailyReports } from "@/lib/queries/dailyReports";
import type { DailyReportRow } from "@/lib/dto";
import DailyReportsTable from "@/components/daily-reports/DailyReportsTable";
import { getPermissionSnapshot } from "@/lib/currentUser";
import { can, PERM } from "@/lib/permissions";

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
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

export default async function DailyReportsListPage() {
  const snap = await getPermissionSnapshot();

  if (!can(snap, PERM.DAILY_REPORTS_READ)) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="text-base font-semibold">Raporty dzienne</div>
        <div className="text-xs opacity-70 mt-1">
          Nie masz uprawnień do przeglądania raportów dziennych.
        </div>
        <div className="mt-3 text-sm text-foreground/80">Brak dostępu.</div>
      </div>
    );
  }

  const allReports: DailyReportRow[] = await fetchDailyReports();

  // w tym widoku pokazujemy tylko zatwierdzone raporty
  const reports = allReports.filter((r) => r.approved);

  return (
    <main className="space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-base font-semibold leading-tight">Raporty dzienne</h1>
          <p className="text-xs opacity-70 mt-1">
            Lista zatwierdzonych raportów. Filtruj po dacie, brygadzie, osobie, lokalizacji i
            miejscu — kliknij w pozycję, aby zobaczyć szczegóły.
          </p>
        </div>

        <div className="hidden md:grid grid-cols-2 gap-2">
          <Kpi label="Widok" value="zatwierdzone" tone="ok" />
          <Kpi label="Liczba" value={reports.length} />
        </div>
      </header>

      <section className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="p-3 md:p-4 border-b border-border bg-background/10">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] opacity-70">
              {reports.length === 0 ? "Brak danych" : `Wyników: ${reports.length}`}
            </div>
            <div className="md:hidden text-[11px] opacity-70">Zatwierdzone</div>
          </div>
        </div>

        <div className="p-3 md:p-4">
          {reports.length === 0 ? (
            <div className="rounded-2xl border border-border bg-background/20 p-4 text-sm opacity-70">
              Brak zatwierdzonych raportów do wyświetlenia.
            </div>
          ) : (
            <DailyReportsTable reports={reports} snapshot={snap} />
          )}
        </div>
      </section>
    </main>
  );
}