// src/app/(app)/summary/page.tsx
import type React from "react";

import {
  getPvrSummaryOverview,
  getMaterialPricingRollupNow,
  getMaterialPricingByLocationNow,
  getMaterialPricingRollupSpendRange,
  getDeliveriesRangeOverview,
} from "@/lib/queries/pvr";
import { getPurchasesSeries, getDeliveryCostSeries } from "@/lib/queries/pvrSeries";
import { getInventoryAudit } from "@/lib/queries/inventoryAudit";
import { getStockValueSeries } from "@/lib/queries/stockValueSeries";
import { getInventoryShrinkSeries } from "@/lib/queries/inventoryShrinkSeries";
import { fetchInventoryLocations } from "@/lib/queries/inventoryLocations";

import BackButton from "@/components/BackButton";

import SummaryFiltersBar from "@/app/(app)/summary/_components/SummaryFiltersBar";
import SummaryTrendTabs from "@/app/(app)/summary/_components/SummaryTrendTabs";

export const dynamic = "force-dynamic";

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function num(n: number): string {
  return new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 3 }).format(n);
}

function maxISODate(a: string, b: string): string {
  // ISO yyyy-mm-dd lexicographic compare works
  return a >= b ? a : b;
}

export default async function SummaryPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  // ✅ DOMYŚLNIE: zawsze ostatnie 30 dni (ale nie wcześniej niż utworzenie konta, jeśli konto młodsze)
  // Uwaga: nie wciągamy już "od utworzenia konta" jako default, bo chcesz globalnie "miesiąc wstecz".
  const defaultTo = todayISO();
  const defaultFromBase = daysAgoISO(30);

  // (opcjonalny bezpiecznik: jeśli konto jest młodsze, nie cofamy się przed creation date)
  // Jak nie chcesz tego bezpiecznika – usuń import i tę linijkę.
  // (Tu go NIE używamy, bo nie podałeś już getAccountCreatedAtISO jako wymagania UX.)
  const defaultFrom = defaultFromBase;

  const from = typeof searchParams.from === "string" ? searchParams.from : defaultFrom;
  const to = typeof searchParams.to === "string" ? searchParams.to : defaultTo;

  const loc =
    typeof searchParams.loc === "string" && searchParams.loc.length > 0 ? searchParams.loc : null;

  const locations = await fetchInventoryLocations({
    includeDeleted: true,
    onlyWithMaterials: false,
  });

  const data = await getPvrSummaryOverview({ from, to, inventory_location_id: loc });

  // ✅ global rollup (prawa tabela gdy loc=null)
  const pricingRollup = await getMaterialPricingRollupNow();

  // ✅ per-lokacja (prawa tabela gdy loc!=null)
  const pricingByLocation = loc
    ? await getMaterialPricingByLocationNow({ inventory_location_id: loc })
    : [];

  const rollupSpendRange = await getMaterialPricingRollupSpendRange({
    from,
    to,
    inventory_location_id: loc,
  });

  const deliveriesRows = await getDeliveriesRangeOverview({
    from,
    to,
    inventory_location_id: loc,
  });

  // ✅ ZAWSZE day (UI agreguje tydzień/miesiąc)
  const purchasesSeries = await getPurchasesSeries({
    from,
    to,
    inventory_location_id: loc,
    granularity: "day",
  });

  // ✅ ZAWSZE day (UI agreguje tydzień/miesiąc)
  const deliveryCostSeries = await getDeliveryCostSeries({
    from,
    to,
    inventory_location_id: loc,
    granularity: "day",
  });

  const stockValueSeries = await getStockValueSeries({
    from,
    to,
    inventory_location_id: loc,
  });

  // ✅ ZAWSZE day (UI agreguje tydzień/miesiąc)
  const inventoryShrinkSeries = await getInventoryShrinkSeries({
    from,
    to,
    inventory_location_id: loc,
    granularity: "day",
  });

  const inventoryAudit = await getInventoryAudit({
    from,
    to,
    inventory_location_id: loc,
  });

  const stockValueNow = data.totals.stock_value_now_est ?? 0;

  const stockQtyNowRaw = data.totals.stock_qty_now;
  const stockQtyNowKnown = typeof stockQtyNowRaw === "number" && Number.isFinite(stockQtyNowRaw);

  const shrinkValue = data.totals.shrink_value_est ?? 0;
  const shrinkQty = data.totals.shrink_qty ?? 0;

  return (
    <div className="space-y-4">
      {/* TOOLBAR: tylko BackButton po prawej */}
      <div className="flex items-center justify-end">
        <BackButton />
      </div>

      <SummaryFiltersBar
        from={from}
        to={to}
        loc={loc}
        locations={locations}
        defaultFrom={defaultFrom}
        defaultTo={defaultTo}
      />

      {!stockQtyNowKnown ? (
        <div className="card p-4">
          <div className="text-sm font-semibold">Uwaga: brak stanu “teraz” z DB</div>
          <div className="mt-1 text-sm text-muted-foreground">
            RPC <span className="font-mono text-foreground">pvr_summary_overview</span> nie zwraca{" "}
            <span className="font-mono text-foreground">totals.stock_qty_now</span>.
          </div>
        </div>
      ) : stockQtyNowRaw! < 0 ? (
        <div className="card p-4">
          <div className="text-sm font-semibold">Uwaga: ujemny stan magazynu</div>
          <div className="mt-1 text-sm text-muted-foreground">
            stock_qty_now ={" "}
            <span className="font-mono text-foreground">{num(stockQtyNowRaw!)}</span>.
          </div>
        </div>
      ) : null}

      <SummaryTrendTabs
        from={from}
        to={to}
        loc={loc}
        purchasesTotalValue={data.totals.materials_in_value ?? 0}
        purchasesTotalQty={data.totals.materials_in_qty ?? 0}
        deliveryCostTotalValue={data.totals.delivery_cost_value ?? 0}
        deliveriesCount={data.totals.deliveries_count ?? 0}
        stockValueNow={stockValueNow}
        shrinkValue={shrinkValue}
        shrinkQty={shrinkQty}
        purchasesSeries={purchasesSeries}
        deliveryCostSeries={deliveryCostSeries}
        stockValueSeries={stockValueSeries}
        inventoryShrinkSeries={inventoryShrinkSeries}
        pricingRollupRows={pricingRollup}
        pricingByLocationRows={pricingByLocation}
        inventoryAudit={inventoryAudit}
        rollupSpendRangeRows={rollupSpendRange}
        deliveriesRangeRows={deliveriesRows}
      />

      {data.notes && data.notes.length > 0 ? (
        <div className="card p-4">
          <div className="text-sm font-semibold">Uwagi</div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {data.notes.map((n, idx) => (
              <li key={idx}>{n}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}