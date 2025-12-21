// src/app/(app)/analyze/metrics/_components/KpiGrid.tsx
// Client — 4 KPI cards (koszt materiałów, koszt zużycia, approval, plan)

"use client";

import type { ProjectMetricsDashRow } from "@/lib/dto/metrics";

type Props = {
  data: ProjectMetricsDashRow;
};

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

function fmtMoney(v: number) {
  const n = Number.isFinite(v) ? v : 0;
  return new Intl.NumberFormat("pl-PL", {
    style: "decimal",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtHours(v: number) {
  if (!Number.isFinite(v)) return "—";
  if (v < 1) return `${Math.round(v * 60)} min`;
  if (v < 24) return `${v.toFixed(1)} h`;
  return `${(v / 24).toFixed(1)} d`;
}

function badgeForDelta(pct: number) {
  if (!Number.isFinite(pct)) return { text: "—", cls: "text-muted-foreground" };
  if (pct <= 5) return { text: `+${pct.toFixed(0)}%`, cls: "text-green-400" };
  if (pct <= 15) return { text: `+${pct.toFixed(0)}%`, cls: "text-yellow-300" };
  return { text: `+${pct.toFixed(0)}%`, cls: "text-red-400" };
}

export default function KpiGrid({ data }: Props) {
  const materials = data.materials_cost_total ?? 0;
  const usage = data.usage_cost_total ?? 0;

  const pct =
    materials > 0 ? ((usage - materials) / materials) * 100 : Number.NaN;

  const delta =
    Number.isFinite(pct) && materials > 0
      ? badgeForDelta(Math.abs(pct))
      : { text: "—", cls: "text-muted-foreground" };

  const deltaLabel =
    materials > 0 && Number.isFinite(pct)
      ? pct >= 0
        ? "Zużycie vs materiały"
        : "Zużycie vs materiały"
      : "Zużycie vs materiały";

  const approval = data.avg_approval_hours ?? 0;

  const within = data.within_plan_count ?? 0;
  const over = data.over_plan_count ?? 0;

  const planStatus =
    over === 0 ? "W planie" : over <= 2 ? "Na granicy" : "Poza planem";

  const planColor =
    over === 0
      ? "text-green-400"
      : over <= 2
      ? "text-yellow-300"
      : "text-red-400";

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {/* KPI: Koszt materiałów */}
      <div className="card p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground">
              Koszt materiałów
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">
              {fmtMoney(materials)}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Suma materiałów z dostaw
            </p>
          </div>
        </div>
      </div>

      {/* KPI: Koszt zużycia */}
      <div className="card p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground">
              Koszt zużycia
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">
              {fmtMoney(usage)}
            </p>

            <div className="mt-2 flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">
                {deltaLabel}
              </span>
              <span className={cx("text-[11px] font-semibold", delta.cls)}>
                {delta.text}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI: Śr. approval */}
      <div className="card p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground">
              Śr. approval
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">
              {fmtHours(approval)}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Dostawy + raporty dzienne
            </p>
          </div>
        </div>
      </div>

      {/* KPI: Plan (within/over) */}
      <div className="card p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground">
              Plan
            </p>

            <p className={cx("mt-1 text-2xl font-semibold tracking-tight", planColor)}>
              {planStatus}
            </p>

            <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/20 px-2 py-0.5">
                <span className="h-2 w-2 rounded-full bg-green-500/70" />
                within: <span className="text-foreground">{within}</span>
              </span>

              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/20 px-2 py-0.5">
                <span className="h-2 w-2 rounded-full bg-red-500/70" />
                over: <span className="text-foreground">{over}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
