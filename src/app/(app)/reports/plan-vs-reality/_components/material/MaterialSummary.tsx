"use client";

import type { DesignerDashOverviewRow } from "@/lib/dto/designerDash";

type Props = {
  row: DesignerDashOverviewRow;
};

function fmtDate(v: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export default function MaterialSummary({ row }: Props) {
  const planned = row.planned_qty ?? 0;
  const used = row.used_qty ?? 0;
  const delivered = row.delivered_qty ?? 0;

  const usedPct = planned > 0 ? (used / planned) * 100 : null;
  const deliveredPct = planned > 0 ? (delivered / planned) * 100 : null;

  const overPlan = used - planned;
  const supplyGap = used - delivered;

  return (
    <div className="card p-4 space-y-2">
      <div>
        <div className="text-sm font-semibold">{row.rep_title ?? row.family_key}</div>
        <div className="text-xs text-foreground/60 font-mono">{row.family_key}</div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3 text-sm">
        <div className="card p-3">
          <div className="text-xs text-foreground/60">Plan</div>
          <div className="text-lg font-semibold font-mono">{Math.round(planned)}</div>
        </div>
        <div className="card p-3">
          <div className="text-xs text-foreground/60">Zużyto</div>
          <div className="text-lg font-semibold font-mono">{Math.round(used)}</div>
          <div className="text-xs text-foreground/60">{usedPct == null ? "—" : `${usedPct.toFixed(1)}% planu`}</div>
        </div>
        <div className="card p-3">
          <div className="text-xs text-foreground/60">Dostarczono</div>
          <div className="text-lg font-semibold font-mono">{Math.round(delivered)}</div>
          <div className="text-xs text-foreground/60">{deliveredPct == null ? "—" : `${deliveredPct.toFixed(1)}% planu`}</div>
        </div>
      </div>

      <div className="text-sm">
        <div>
          <span className="text-foreground/60">Przekroczenie planu:</span>{" "}
          <span className={`font-mono ${overPlan > 0 ? "text-red-400" : ""}`}>{Math.round(overPlan)}</span>
        </div>
        <div>
          <span className="text-foreground/60">Zużycie - dostawy:</span>{" "}
          <span className={`font-mono ${supplyGap > 0 ? "text-red-400" : ""}`}>{Math.round(supplyGap)}</span>
        </div>
        <div className="mt-1 text-xs text-foreground/60">
          Ostatnie użycie: <span className="font-mono">{fmtDate(row.last_usage_at)}</span> •
          Ostatnia dostawa: <span className="font-mono">{fmtDate(row.last_delivery_at)}</span>
        </div>
      </div>
    </div>
  );
}
