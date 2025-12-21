"use client";

import type {
  DesignerDashOverviewRow,
  DesignerDashTimeseriesPoint,
} from "@/lib/dto/designerDash";

import MonthlyBarChart from "./MonthlyBarChart";
import CumulativeLineChart from "./CumulativeLineChart";
import UsageTable from "./UsageTable";

type Props = {
  overviewRows: DesignerDashOverviewRow[];
  timeseries: DesignerDashTimeseriesPoint[];
  onPickFamily?: (familyKey: string) => void; // opcjonalnie pod TAB "material"
};

function toNum(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v) || 0;
  return 0;
}

export default function UsageView({ overviewRows, timeseries, onPickFamily }: Props) {
  const totalPlanned = overviewRows.reduce((acc, r) => acc + toNum(r.planned_qty), 0);
  const totalUsed = overviewRows.reduce((acc, r) => acc + toNum(r.used_qty), 0);

  // dane do słupków (miesiąc -> used)
  const monthly = timeseries
    .map((p) => ({
      bucket_month: p.bucket_month,
      value: toNum(p.used_qty),
    }))
    .sort((a, b) => a.bucket_month.localeCompare(b.bucket_month));

  // dane do linii kumulacyjnej
  let run = 0;
  const cumulative = monthly.map((m) => {
    run += m.value;
    return { bucket_month: m.bucket_month, value: run };
  });

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="text-sm font-semibold">Zużycie (Real)</div>
        <div className="mt-1 text-xs text-foreground/60">
          Słupki: miesięczne zużycie • Linia: kumulacja zużycia vs plan
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <div className="text-sm font-semibold">Zużycie miesięczne</div>
          <div className="mt-1 text-xs text-foreground/60">
            (approved daily_reports)
          </div>
          <div className="mt-3">
            <MonthlyBarChart data={monthly} />
          </div>
        </div>

        <div className="card p-4">
          <div className="text-sm font-semibold">Kumulacja zużycia vs plan</div>
          <div className="mt-1 text-xs text-foreground/60">
            Plan = suma planned_qty z planu projektanta
          </div>
          <div className="mt-3">
            <CumulativeLineChart data={cumulative} planTotal={totalPlanned} />
          </div>
          <div className="mt-3 text-xs text-foreground/60">
            Kumulacja: <span className="font-mono">{Math.round(totalUsed)}</span> / Plan:{" "}
            <span className="font-mono">{Math.round(totalPlanned)}</span>
          </div>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">TOP materiałów wg % planu</div>
            <div className="mt-1 text-xs text-foreground/60">
              Klik w wiersz może później przełączać na widok „Materiał”
            </div>
          </div>
        </div>

        <div className="mt-3">
          <UsageTable rows={overviewRows} onPickFamily={onPickFamily} />
        </div>
      </div>
    </div>
  );
}
