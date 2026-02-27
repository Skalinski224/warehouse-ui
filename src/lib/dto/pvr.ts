// src/lib/dto/pvr.ts
export type PvrTimeSeriesPoint = {
    bucket: string; // np. "2025-12-01" (start tygodnia)
    stock_value_est: number | null;
    shrink_value_est: number | null;
    purchases_value: number | null;
  };
  
  export type PvrSummaryTotals = {
    materials_in_qty: number | null;
    materials_in_value: number | null;
    delivery_cost_value: number | null;
    deliveries_count: number | null;
  
    // DB powinno to zwracać; front nie powinien zgadywać z inventory_movements
    stock_value_now_est: number | null;
    stock_qty_now: number | null;
  
    // ✅ "shrink" = strata po inwentaryzacji (loss_qty/loss_value_est)
    shrink_qty: number | null;
    shrink_value_est: number | null;
  
    // ✅ dodatkowe metryki (dla prawdy + debugowania)
    inventory_gain_qty?: number | null;
    inventory_gain_value_est?: number | null;
    inventory_net_qty?: number | null;
    inventory_net_value_est?: number | null;
  };
  
  export type PvrSummaryOverviewDto = {
    meta: {
      from: string;
      to: string;
      inventory_location_id: string | null;
    };
    totals: PvrSummaryTotals;
    time_series_weekly: PvrTimeSeriesPoint[];
    notes?: string[] | null;
  };
  
  // ✅ pricing (rollup/global)
  export type MaterialPricingRollupRow = {
    rollup_key: string;
    // ✅ NEW: jeśli view zwraca, UI pokaże ładnie zamiast pr_t_20
    rollup_label?: string | null;
  
    unit: string | null;
    stock_qty_now: number | null;
    wac_unit_price: number | null;
    stock_value_est: number | null;
    priced_qty_total: number | null;
    priced_value_total: number | null;
    last_priced_delivery_date: string | null;
  };
  
  // ✅ pricing (per lokalizacja / material)
  export type MaterialPricingByLocationRow = {
    material_id: string;
    title: string;
    family_key: string | null;
    unit: string | null;
    inventory_location_id: string | null;
  
    // ✅ NEW: jeśli view dopniesz, to UI może pokazać label zamiast uuid
    inventory_location_label?: string | null;
  
    stock_qty_now: number | null;
    wac_unit_price: number | null;
    stock_value_est: number | null;
  
    priced_qty_total: number | null;
    last_priced_delivery_date: string | null;
  };
  
  /**
   * ✅ NEW: “ile wydaliśmy” per rollup (family_key/title) w zakresie dat
   * WAC jest liczony "as-of to" (dla spójności z pvr_summary_overview).
   */
  export type MaterialPricingRollupSpendRow = {
    rollup_key: string;
    // ✅ NEW: ludzka nazwa do UI (np. "Pręt 20"), zwracana przez RPC
    rollup_label?: string | null;
  
    unit: string | null;
  
    wac_unit_price_asof_to: number | null;
  
    spent_qty_in_range: number | null;
    spent_value_in_range: number | null;
  
    deliveries_count_in_range: number | null;
    last_delivery_date_in_range: string | null;
  };
  
  // ✅ NEW: tabela dostaw w zakresie dat
  export type DeliveryRangeRow = {
    delivery_id: string;
    delivery_date: string; // YYYY-MM-DD
    inventory_location_id: string | null;
    place_label: string | null;
    supplier: string | null;
  
    created_at: string | null;
    created_by: string | null;
    created_by_name: string | null;
  
    approved: boolean | null;
    approved_at: string | null;
    approved_by: string | null;
    approved_by_name: string | null;
  
    delivery_cost: number | null;
    materials_cost: number | null;
  };
  
  export function unwrapRpcObject<T>(data: unknown): T | null {
    if (!data) return null;
    if (Array.isArray(data)) {
      const first = data[0];
      if (first && typeof first === "object") return first as T;
      return null;
    }
    if (typeof data === "object") return data as T;
    return null;
  }
  
  export function toNum(v: unknown): number | null {
    if (v === null || v === undefined) return null;
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const n = Number(v.replace(",", "."));
      return Number.isFinite(n) ? n : null;
    }
    return null;
  }
  
  export function normSeries(rows: unknown): PvrTimeSeriesPoint[] {
    if (!Array.isArray(rows)) return [];
    return rows
      .map((r: any) => ({
        bucket: String(
          r?.bucket ??
            r?.week ??
            r?.week_start ??
            r?.week_start_date ??
            r?.start_date ??
            r?.label ??
            ""
        ),
        stock_value_est: toNum(r?.stock_value_est ?? r?.stock_value ?? r?.stock),
        shrink_value_est: toNum(
          r?.shrink_value_est ?? r?.shrink_value ?? r?.shrink
        ),
        purchases_value: toNum(
          r?.purchases_value ?? r?.purchases ?? r?.materials_in_value
        ),
      }))
      .filter((x) => x.bucket);
  }
  
  // ✅ bezpieczna średnia ważona (np. dla średniej ceny magazynu)
  export function safeDiv(num: number, den: number): number | null {
    if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
    return num / den;
  }