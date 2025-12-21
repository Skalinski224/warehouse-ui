"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type {
  DesignerDashTab,
  DesignerDashOverviewRow,
  DesignerDashTimeseriesPoint,
} from "@/lib/dto/designerDash";

import UsageView from "./usage/UsageView";
import SupplyView from "./supply/SupplyView";
import DeviationsView from "./deviations/DeviationsView";
import MaterialView from "./material/MaterialView";

type Props = {
  tab: DesignerDashTab; // z servera (już zwalidowany w page.tsx)
  overviewRows: DesignerDashOverviewRow[];
  timeseries: DesignerDashTimeseriesPoint[];
};

function parseTab(v: string | null): DesignerDashTab {
  if (v === "real" || v === "supply" || v === "deviations" || v === "material") return v;
  return "real";
}

export default function TabViewsClient({ tab, overviewRows, timeseries }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  // ✅ jeśli URL ma tab, to go respektujemy (ale walidujemy)
  const urlTab = parseTab(sp.get("tab"));
  const activeTab: DesignerDashTab = urlTab ?? tab;

  const pickedFamily = sp.get("family");

  const goMaterial = (familyKey: string) => {
    const params = new URLSearchParams(sp.toString());
    params.set("tab", "material");
    params.set("family", familyKey);
    router.replace(`${pathname}?${params.toString()}`);
  };

  if (activeTab === "real") {
    return (
      <UsageView
        overviewRows={overviewRows}
        timeseries={timeseries}
        onPickFamily={goMaterial}
      />
    );
  }

  if (activeTab === "supply") {
    return (
      <SupplyView
        overviewRows={overviewRows}
        timeseries={timeseries}
        onPickFamily={goMaterial}
      />
    );
  }

  if (activeTab === "deviations") {
    return (
      <DeviationsView
        overviewRows={overviewRows}
        timeseries={timeseries}
        onPickFamily={goMaterial}
      />
    );
  }

  return (
    <MaterialView
      overviewRows={overviewRows}
      timeseries={timeseries}
      pickedFamily={pickedFamily}
    />
  );
}
