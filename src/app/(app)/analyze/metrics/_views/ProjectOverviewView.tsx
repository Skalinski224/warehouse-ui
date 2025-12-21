// src/app/(app)/analyze/metrics/_views/ProjectOverviewView.tsx
// Widok — „Projekt w liczbach” — KPI, Status, Charts, TopUsage
// ETAP 5: podpięte realne wykresy (CostsStackedBar + CumulativeCostLine)
import ProjectStatusCard from "../_components/ProjectStatusCard";
import KpiGrid from "../_components/KpiGrid";
import ChartCard from "../_components/ChartCard";
import TopUsageTable from "../_components/TopUsageTable";

import CostsStackedBar from "../_components/charts/CostsStackedBar";
import CumulativeCostLine from "../_components/charts/CumulativeCostLine";

import type { ProjectMetricsDashRow } from "@/lib/dto/metrics";

type Props = {
  data: ProjectMetricsDashRow;

  from: string | null;
  to: string | null;
  place: string | null;
};

export default function ProjectOverviewView({ data }: Props) {
  const stacked = data.costs_by_bucket ?? [];
  const cumulative = data.cumulative_costs_by_bucket ?? [];

  return (
    <div className="space-y-4">
      {/* 1) STATUS */}
      <ProjectStatusCard data={data} />

      {/* 2) KPI */}
      <KpiGrid data={data} />

      {/* 3) WYKRESY */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Dostawy vs Zużycie"
          subtitle="Koszty per bucket (tydzień/miesiąc) — stacked"
          kind="stacked"
          emptyHint="Brak bucketów. Upewnij się, że RPC zwraca costs_by_bucket."
        >
          <CostsStackedBar data={stacked} bucketLabel="Tydzień" />
        </ChartCard>

        <ChartCard
          title="Narastający koszt"
          subtitle="Cumulative w czasie — linia"
          kind="line"
          emptyHint="Brak serii cumulative. Upewnij się, że RPC zwraca cumulative_costs_by_bucket."
        >
          <CumulativeCostLine data={cumulative} bucketLabel="Tydzień" />
        </ChartCard>
      </div>

      {/* 4) TOP 5 */}
      <TopUsageTable data={data.top_usage ?? []} />
    </div>
  );
}
