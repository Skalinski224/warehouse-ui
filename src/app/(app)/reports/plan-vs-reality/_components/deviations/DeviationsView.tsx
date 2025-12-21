"use client";

import type { DesignerDashOverviewRow, DesignerDashTimeseriesPoint } from "@/lib/dto/designerDash";
import DeviationsTable from "./DeviationsTable";

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

export default function DeviationsView({ overviewRows, onPickFamily }: Props) {
  const totalPlanned = overviewRows.reduce((acc, r) => acc + toNum(r.planned_qty), 0);
  const totalUsed = overviewRows.reduce((acc, r) => acc + toNum(r.used_qty), 0);
  const totalDelivered = overviewRows.reduce((acc, r) => acc + toNum(r.delivered_qty), 0);

  const overPlanCount = overviewRows.filter((r) => (r.used_qty ?? 0) > (r.planned_qty ?? 0)).length;
  const supplyGapCount = overviewRows.filter((r) => (r.used_qty ?? 0) > (r.delivered_qty ?? 0)).length;

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="text-sm font-semibold">Odchylenia i ryzyka</div>
        <div className="mt-1 text-xs text-foreground/60">
          Tu wyciągamy „problemy”: przekroczenia planu i braki w dostawach względem zużycia.
        </div>
      </div>

      <div className="card p-4 text-sm">
        <div className="flex flex-wrap gap-4">
          <div>
            <span className="text-foreground/60">Plan:</span>{" "}
            <span className="font-mono">{Math.round(totalPlanned)}</span>
          </div>
          <div>
            <span className="text-foreground/60">Zużyto:</span>{" "}
            <span className="font-mono">{Math.round(totalUsed)}</span>
          </div>
          <div>
            <span className="text-foreground/60">Dostarczono:</span>{" "}
            <span className="font-mono">{Math.round(totalDelivered)}</span>
          </div>
          <div>
            <span className="text-foreground/60">Przekroczone planem:</span>{" "}
            <span className={`font-mono ${overPlanCount > 0 ? "text-red-400" : ""}`}>{overPlanCount}</span>
          </div>
          <div>
            <span className="text-foreground/60">Zużycie {" > "} dostawy:</span>{" "}
            <span className={`font-mono ${supplyGapCount > 0 ? "text-red-400" : ""}`}>{supplyGapCount}</span>
          </div>
        </div>
      </div>

      <DeviationsTable rows={overviewRows} onPickFamily={onPickFamily} />
    </div>
  );
}
