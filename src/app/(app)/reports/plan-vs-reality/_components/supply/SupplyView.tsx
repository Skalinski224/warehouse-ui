"use client";

import type { DesignerDashOverviewRow, DesignerDashTimeseriesPoint } from "@/lib/dto/designerDash";
import SupplyMonthlyBarChart from "./SupplyMonthlyBarChart";
import SupplyCumulativeLineChart from "./SupplyCumulativeLineChart";
import SupplyTable from "./SupplyTable";

type Props = {
  overviewRows: DesignerDashOverviewRow[];
  timeseries: DesignerDashTimeseriesPoint[];
  onPickFamily?: (familyKey: string) => void;
};

function toNum(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v) || 0;
  return 0;
}

export default function SupplyView({ overviewRows, timeseries, onPickFamily }: Props) {
  const totalPlanned = overviewRows.reduce((acc, r) => acc + toNum(r.planned_qty), 0);
  const totalDelivered = overviewRows.reduce((acc, r) => acc + toNum(r.delivered_qty), 0);

  const monthly = timeseries
    .map((p) => ({ bucket_month: p.bucket_month, value: toNum(p.delivered_qty) }))
    .sort((a, b) => a.bucket_month.localeCompare(b.bucket_month));

  let run = 0;
  const cumulative = monthly.map((m) => {
    run += m.value;
    return { bucket_month: m.bucket_month, value: run };
  });

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="text-sm font-semibold">Dostawy (Supply)</div>
        <div className="mt-1 text-xs text-foreground/60">
          Słupki: miesięczne dostawy • Linia: kumulacja dostaw vs plan
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <div className="text-sm font-semibold">Dostawy miesięczne</div>
          <div className="mt-1 text-xs text-foreground/60">
            (approved deliveries + delivery_items)
          </div>
          <div className="mt-3">
            <SupplyMonthlyBarChart data={monthly} />
          </div>
        </div>

        <div className="card p-4">
          <div className="text-sm font-semibold">Kumulacja dostaw vs plan</div>
          <div className="mt-1 text-xs text-foreground/60">
            Plan = suma planned_qty z planu projektanta
          </div>
          <div className="mt-3">
            <SupplyCumulativeLineChart data={cumulative} planTotal={totalPlanned} />
          </div>
          <div className="mt-3 text-xs text-foreground/60">
            Kumulacja: <span className="font-mono">{Math.round(totalDelivered)}</span> / Plan:{" "}
            <span className="font-mono">{Math.round(totalPlanned)}</span>
          </div>
        </div>
      </div>

      <div className="card p-4">
        <div className="text-sm font-semibold">TOP materiałów wg % pokrycia planu dostawami</div>
        <div className="mt-1 text-xs text-foreground/60">
          Klik w wiersz może przełączać na widok „Materiał”
        </div>

        <div className="mt-3">
          <SupplyTable rows={overviewRows} onPickFamily={onPickFamily} />
        </div>
      </div>
    </div>
  );
}
