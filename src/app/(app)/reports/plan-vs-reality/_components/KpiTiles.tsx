import type { DesignerDashOverviewRow } from "@/lib/dto/designerDash";

/**
 * KpiTiles
 *
 * ZASADY:
 * - zero fetchy
 * - zero stanu
 * - tylko czysta agregacja liczb
 */

type Props = {
  overviewRows: DesignerDashOverviewRow[];
};

export default function KpiTiles({ overviewRows }: Props) {
  const totals = overviewRows.reduce(
    (acc, row) => {
      acc.planned += row.planned_qty ?? 0;
      acc.used += row.used_qty ?? 0;
      acc.delivered += row.delivered_qty ?? 0;

      if ((row.used_qty ?? 0) > (row.planned_qty ?? 0)) {
        acc.overPlanCount += 1;
      }

      if ((row.used_qty ?? 0) === 0) {
        acc.zeroUsageCount += 1;
      }

      return acc;
    },
    {
      planned: 0,
      used: 0,
      delivered: 0,
      overPlanCount: 0,
      zeroUsageCount: 0,
    }
  );

  const materialCount = overviewRows.length;

  const usedVsPlannedPct =
    totals.planned > 0 ? (totals.used / totals.planned) * 100 : null;

  const deliveredVsPlannedPct =
    totals.planned > 0 ? (totals.delivered / totals.planned) * 100 : null;

  const usedVsDeliveredPct =
    totals.delivered > 0 ? (totals.used / totals.delivered) * 100 : null;

  const supplyMismatch =
    usedVsDeliveredPct !== null && usedVsDeliveredPct > 100;

  return (
    <div className="space-y-4">
      {/* KPI tiles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiTile
          title="Wykonanie planu"
          value={formatPct(usedVsPlannedPct)}
          subtitle={`Zużyto ${formatNum(totals.used)} z ${formatNum(
            totals.planned
          )}`}
        />

        <KpiTile
          title="Pokrycie planu dostawami"
          value={formatPct(deliveredVsPlannedPct)}
          subtitle={`Dostarczono ${formatNum(
            totals.delivered
          )} z ${formatNum(totals.planned)}`}
        />

        <KpiTile
          title="Zużycie vs dostarczone"
          value={formatPct(usedVsDeliveredPct)}
          subtitle={`Zużyto ${formatNum(totals.used)} z ${formatNum(
            totals.delivered
          )}`}
          tone={supplyMismatch ? "danger" : "default"}
          warning={
            supplyMismatch
              ? "Zużycie większe niż dostawy — sprawdź akceptację dostaw lub raporty."
              : undefined
          }
        />
      </div>

      {/* Mini stats */}
      <div className="card px-4 py-3 flex flex-wrap gap-4 text-sm">
        <MiniStat
          label="Materiałów w planie"
          value={materialCount}
        />
        <MiniStat
          label="Przekroczone planem"
          value={totals.overPlanCount}
          highlight={totals.overPlanCount > 0}
        />
        <MiniStat
          label="Bez zużycia"
          value={totals.zeroUsageCount}
        />
      </div>
    </div>
  );
}

/* ---------- helpers ---------- */

function formatPct(value: number | null) {
  if (value === null || Number.isNaN(value)) return "—";
  return `${value.toFixed(1)}%`;
}

function formatNum(value: number) {
  return value.toLocaleString("pl-PL");
}

/* ---------- UI primitives ---------- */

function KpiTile({
  title,
  value,
  subtitle,
  tone = "default",
  warning,
}: {
  title: string;
  value: string;
  subtitle: string;
  tone?: "default" | "danger";
  warning?: string;
}) {
  return (
    <div
      className={`card p-4 ${
        tone === "danger" ? "border border-red-500/40" : ""
      }`}
    >
      <div className="text-sm text-foreground/60">{title}</div>
      <div className="text-3xl font-semibold mt-1">{value}</div>
      <div className="text-xs text-foreground/60 mt-1">{subtitle}</div>

      {warning && (
        <div className="mt-2 text-xs text-red-400">
          {warning}
        </div>
      )}
    </div>
  );
}

function MiniStat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-foreground/60">{label}:</span>
      <span
        className={`font-medium ${
          highlight ? "text-red-400" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}
