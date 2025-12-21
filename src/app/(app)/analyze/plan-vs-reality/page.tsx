// src/app/(app)/analyze/plan-vs-reality/page.tsx
import type { Metadata } from "next";
import type { DesignerDashFilters, DesignerDashTab } from "@/lib/dto/designerDash";
import { fetchDesignerDashOverview, fetchDesignerDashTimeseries } from "@/lib/queries/designerDash";

// ✅ używamy tych samych komponentów, które już masz w /reports/plan-vs-reality
import FiltersBar from "@/app/(app)/reports/plan-vs-reality/_components/FiltersBar";
import KpiTiles from "@/app/(app)/reports/plan-vs-reality/_components/KpiTiles";
import Tabs from "@/app/(app)/reports/plan-vs-reality/_components/Tabs";
import TabViewsClient from "@/app/(app)/reports/plan-vs-reality/_components/TabViewsClient";

import { getPermissionSnapshot } from "@/lib/currentUser";
import { can, PERM } from "@/lib/permissions";

export const metadata: Metadata = {
  title: "Projektant vs Rzeczywistość (Analyze)",
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(sp: SearchParams, key: string): string | null {
  const v = sp[key];
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

function parseTab(v: string | null): DesignerDashTab {
  if (v === "real" || v === "supply" || v === "deviations" || v === "material") return v;
  return "real";
}

function buildFilters(searchParams: SearchParams): DesignerDashFilters {
  return {
    from_date: first(searchParams, "from"),
    to_date: first(searchParams, "to"),
    stage_id: first(searchParams, "stage"),
    place_id: first(searchParams, "place"),
    family: first(searchParams, "family"),
  };
}

export default async function AnalyzeDesignerVsRealPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // ✅ GATE — tylko manager + owner (tak jak było)
  const snap = await getPermissionSnapshot();
  if (!can(snap, PERM.METRICS_READ)) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-sm text-foreground/80">
        Brak dostępu.
      </div>
    );
  }

  const tab = parseTab(first(searchParams, "tab"));
  const filters = buildFilters(searchParams);

  const [overviewRows, timeseries] = await Promise.all([
    fetchDesignerDashOverview(filters),
    fetchDesignerDashTimeseries(filters),
  ]);

  return (
    <div className="space-y-4">
      <FiltersBar />
      <KpiTiles overviewRows={overviewRows} />
      <Tabs />

      {/* wszystkie widoki + nawigacja (klik w tabelę → tab=material&family=...) */}
      <TabViewsClient tab={tab} overviewRows={overviewRows} timeseries={timeseries} />
    </div>
  );
}
