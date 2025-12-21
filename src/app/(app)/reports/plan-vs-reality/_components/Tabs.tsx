"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DesignerDashTab } from "@/lib/dto/designerDash";

const TABS: { key: DesignerDashTab; label: string }[] = [
  { key: "real", label: "Zużycie" },
  { key: "supply", label: "Dostawy" },
  { key: "deviations", label: "Odchylenia" },
  { key: "material", label: "Materiał" },
];

export default function Tabs() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeTab =
    (searchParams.get("tab") as DesignerDashTab) ?? "real";

  const setTab = (tab: DesignerDashTab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="border-b border-border flex gap-1">
      {TABS.map((tab) => {
        const isActive = tab.key === activeTab;

        return (
          <button
            key={tab.key}
            onClick={() => setTab(tab.key)}
            className={`px-4 py-2 text-sm border-b-2 transition ${
              isActive
                ? "border-foreground text-foreground"
                : "border-transparent text-foreground/60 hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
