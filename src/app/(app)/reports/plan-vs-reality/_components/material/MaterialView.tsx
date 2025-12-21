"use client";

import type { DesignerDashOverviewRow, DesignerDashTimeseriesPoint } from "@/lib/dto/designerDash";
import MaterialSummary from "./MaterialSummary";
import MaterialTimeseriesTable from "./MaterialTimeseriesTable";

type Props = {
  overviewRows: DesignerDashOverviewRow[];
  timeseries: DesignerDashTimeseriesPoint[];
  pickedFamily: string | null;
};

export default function MaterialView({ overviewRows, timeseries, pickedFamily }: Props) {
  if (!pickedFamily) {
    return (
      <div className="card p-4">
        <div className="text-sm font-semibold">Materiał</div>
        <div className="mt-2 text-sm text-foreground/60">
          Kliknij w wiersz w tabeli (Zużycie/Dostawy/Odchylenia), żeby przejść do szczegółu rodziny materiału.
        </div>
      </div>
    );
  }

  const row = overviewRows.find((r) => r.family_key === pickedFamily) ?? null;

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="text-sm font-semibold">Materiał — szczegół</div>
        <div className="mt-1 text-xs text-foreground/60">
          Filtr aktywny: <span className="font-mono">{pickedFamily}</span>
        </div>
      </div>

      {row ? <MaterialSummary row={row} /> : (
        <div className="card p-4 text-sm text-foreground/60">
          Brak wiersza overview dla tej rodziny (sprawdź czy rodzina jest w planie projektanta).
        </div>
      )}

      <div className="card p-4">
        <div className="text-sm font-semibold">Historia (miesięcznie)</div>
        <div className="mt-3">
          <MaterialTimeseriesTable timeseries={timeseries} />
        </div>
      </div>
    </div>
  );
}
