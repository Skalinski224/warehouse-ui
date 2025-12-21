// src/app/(app)/reports/daily/page.tsx
import { fetchDailyReports } from "@/lib/queries/dailyReports";
import type { DailyReportRow } from "@/lib/dto";
import DailyReportsTable from "@/components/daily-reports/DailyReportsTable";
import { getPermissionSnapshot } from "@/lib/currentUser";
import { can, PERM } from "@/lib/permissions";

export default async function DailyReportsListPage() {
  const snap = await getPermissionSnapshot();

  // worker → brak dostępu do raportów dziennych
  if (!can(snap, PERM.DAILY_REPORTS_READ)) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="text-sm font-medium">Raporty dzienne</div>
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
    <div className="space-y-4">
      {/* HEADER (kanon) */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-sm font-medium">Raporty dzienne</h1>
          <p className="text-xs opacity-70">
            Lista zatwierdzonych raportów z budowy. Filtruj po dacie, brygadzie,
            osobie i miejscu oraz przechodź do szczegółów.
          </p>
        </div>

        {/* META chips (kanon) */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] px-2 py-1 rounded bg-background/60 border border-border">
            Widok: <span className="font-semibold">zatwierdzone</span>
          </span>
          <span className="text-[11px] px-2 py-1 rounded bg-background/60 border border-border">
            Liczba: <span className="font-semibold">{reports.length}</span>
          </span>
        </div>
      </div>

      {/* CONTENT CARD (kanon) */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        {reports.length === 0 ? (
          <div className="text-sm opacity-70">
            Brak zatwierdzonych raportów do wyświetlenia.
          </div>
        ) : (
          <DailyReportsTable reports={reports} snapshot={snap} />
        )}
      </div>
    </div>
  );
}
