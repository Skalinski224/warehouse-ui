// src/lib/queries/pvr.ts
import { supabaseServer } from "@/lib/supabaseServer";
import {
  unwrapRpcObject,
  toNum,
  normSeries,
  type PvrSummaryOverviewDto,
  type MaterialPricingRollupRow,
  type MaterialPricingByLocationRow,
  type MaterialPricingRollupSpendRow,
  type DeliveryRangeRow,
} from "@/lib/dto/pvr";

type RpcCallResult = { data: any; error: any };

async function rpcTry(
  sb: any,
  fn: string,
  args: Record<string, any>
): Promise<RpcCallResult> {
  const { data, error } = await sb.rpc(fn, args);
  return { data, error };
}

function emptySummary(
  from: string,
  to: string,
  locationId: string | null
): PvrSummaryOverviewDto {
  return {
    meta: { from, to, inventory_location_id: locationId },
    totals: {
      materials_in_qty: 0,
      materials_in_value: 0,
      delivery_cost_value: 0,
      deliveries_count: 0,
      stock_value_now_est: 0,
      stock_qty_now: 0,
      shrink_qty: 0,
      shrink_value_est: 0,

      inventory_gain_qty: 0,
      inventory_gain_value_est: 0,
      inventory_net_qty: 0,
      inventory_net_value_est: 0,
    },
    time_series_weekly: [],
    notes: [],
  };
}

function lastNonNullStockValue(
  series: { stock_value_est: number | null }[]
): number {
  for (let i = series.length - 1; i >= 0; i--) {
    const v = series[i]?.stock_value_est;
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return 0;
}

function sumShrinkValue(series: { shrink_value_est: number | null }[]): number {
  let s = 0;
  for (const r of series) {
    const v = r?.shrink_value_est;
    if (typeof v === "number" && Number.isFinite(v)) s += v;
  }
  return s;
}

export async function getPvrSummaryOverview(input: {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  inventory_location_id?: string | null;
}): Promise<PvrSummaryOverviewDto> {
  const from = input.from;
  const to = input.to;
  const loc = input.inventory_location_id ?? null;

  const sb = await supabaseServer();
  const fn = "pvr_summary_overview";

  // ✅ sygnatura DB: (p_from date, p_to date, p_inventory_location_id uuid)
  const args = { p_from: from, p_to: to, p_inventory_location_id: loc };

  const { data, error } = await rpcTry(sb, fn, args);
  if (error) {
    const out = emptySummary(from, to, loc);
    out.notes = [
      "RPC pvr_summary_overview nie zadziałał.",
      error?.message ? String(error.message) : "Brak szczegółów błędu.",
    ];
    return out;
  }

  const obj = unwrapRpcObject<any>(data);
  if (!obj) return emptySummary(from, to, loc);

  const totalsSrc = obj?.totals ?? obj;
  const series = normSeries(obj?.time_series_weekly ?? obj?.time_series ?? []);

  const stockValueNowFallback = lastNonNullStockValue(series);
  const shrinkValueTotalFallback = sumShrinkValue(series);

  const stockValueNow =
    toNum(totalsSrc?.stock_value_now_est) ?? stockValueNowFallback;

  const stockQtyNowRaw = toNum(totalsSrc?.stock_qty_now);
  const stockQtyNow =
    typeof stockQtyNowRaw === "number" && Number.isFinite(stockQtyNowRaw)
      ? stockQtyNowRaw
      : 0;

  const notes: string[] = [];
  if (stockQtyNowRaw === null) {
    notes.push(
      "Brak totals.stock_qty_now z DB — front nie będzie zgadywał z inventory_movements (to kłamie przy limitach i mieszanych typach ruchów)."
    );
  }

  const shrinkQty = toNum(totalsSrc?.shrink_qty) ?? 0;
  const shrinkValue =
    toNum(totalsSrc?.shrink_value_est) ?? shrinkValueTotalFallback;

  const dto: PvrSummaryOverviewDto = {
    meta: { from, to, inventory_location_id: loc },
    totals: {
      materials_in_qty: toNum(totalsSrc?.materials_in_qty) ?? 0,
      materials_in_value: toNum(totalsSrc?.materials_in_value) ?? 0,
      delivery_cost_value: toNum(totalsSrc?.delivery_cost_value) ?? 0,
      deliveries_count: toNum(totalsSrc?.deliveries_count) ?? 0,

      stock_value_now_est: stockValueNow,
      stock_qty_now: stockQtyNow,

      shrink_qty: shrinkQty,
      shrink_value_est: shrinkValue,

      inventory_gain_qty: toNum(totalsSrc?.inventory_gain_qty) ?? 0,
      inventory_gain_value_est:
        toNum(totalsSrc?.inventory_gain_value_est) ?? 0,
      inventory_net_qty: toNum(totalsSrc?.inventory_net_qty) ?? 0,
      inventory_net_value_est:
        toNum(totalsSrc?.inventory_net_value_est) ?? 0,
    },
    time_series_weekly: series,
    notes: [
      ...(Array.isArray(obj?.notes) ? obj.notes.map((x: any) => String(x)) : []),
      ...notes,
    ],
  };

  if ((dto.totals.stock_qty_now ?? 0) < 0) {
    dto.notes = [
      ...(dto.notes ?? []),
      `Uwaga: stock_qty_now wyszedł ujemny (${dto.totals.stock_qty_now}). To oznacza niespójność danych (np. korekty/inwentaryzacje, błędne ruchy albo brakujące wpisy).`,
    ];
  }

  return dto;
}

// ✅ globalny rollup (po rollup_key = family_key/title) z widoku DB
export async function getMaterialPricingRollupNow(): Promise<
  Array<MaterialPricingRollupRow & { _raw?: any }>
> {
  const sb = await supabaseServer();

  // ✅ PO ZMIANIE DB: view ma rollup_label
  const { data, error } = await sb
    .from("v_material_pricing_rollup_now_secure")
    .select(
      "rollup_key, rollup_label, unit, stock_qty_now, wac_unit_price, stock_value_est, priced_qty_total, priced_value_total, last_priced_delivery_date"
    )
    .order("rollup_key", { ascending: true });

  if (error || !Array.isArray(data)) return [];

  return data
    .map((r: any) => ({
      rollup_key: String(r?.rollup_key ?? ""),
      rollup_label: r?.rollup_label ? String(r.rollup_label) : null,

      unit: r?.unit ?? null,
      stock_qty_now: toNum(r?.stock_qty_now),
      wac_unit_price: toNum(r?.wac_unit_price),
      stock_value_est: toNum(r?.stock_value_est),
      priced_qty_total: toNum(r?.priced_qty_total),
      priced_value_total: toNum(r?.priced_value_total),
      last_priced_delivery_date: r?.last_priced_delivery_date
        ? String(r.last_priced_delivery_date)
        : null,
      _raw: r,
    }))
    .filter((x) => x.rollup_key);
}

// ✅ per lokacja/material z widoku DB
export async function getMaterialPricingByLocationNow(input: {
  inventory_location_id: string;
}): Promise<Array<MaterialPricingByLocationRow & { _raw?: any }>> {
  const sb = await supabaseServer();
  const loc = input.inventory_location_id;

  // ✅ PO ZMIANIE DB (opcjonalnie): view może zwrócić inventory_location_label
  const { data, error } = await sb
    .from("v_material_pricing_by_location_now_secure")
    .select(
      "material_id, title, family_key, unit, inventory_location_id, inventory_location_label, stock_qty_now, wac_unit_price, stock_value_est, priced_qty_total, last_priced_delivery_date"
    )
    .eq("inventory_location_id", loc)
    .order("title", { ascending: true });

  if (error || !Array.isArray(data)) return [];

  return data
    .map((r: any) => ({
      material_id: String(r?.material_id ?? ""),
      title: String(r?.title ?? ""),
      family_key: r?.family_key ? String(r.family_key) : null,
      unit: r?.unit ?? null,
      inventory_location_id: r?.inventory_location_id
        ? String(r.inventory_location_id)
        : null,
      inventory_location_label: r?.inventory_location_label
        ? String(r.inventory_location_label)
        : null,

      stock_qty_now: toNum(r?.stock_qty_now),
      wac_unit_price: toNum(r?.wac_unit_price),
      stock_value_est: toNum(r?.stock_value_est),

      priced_qty_total: toNum(r?.priced_qty_total),
      last_priced_delivery_date: r?.last_priced_delivery_date
        ? String(r?.last_priced_delivery_date)
        : null,
      _raw: r,
    }))
    .filter((x) => x.material_id && x.title);
}

/**
 * ✅ NEW: tabela "ile wydaliśmy" w zakresie dat (globalnie po rollup_key)
 * Źródło prawdy: RPC public.pvr_pricing_rollup_spend_range(p_from, p_to, p_inventory_location_id)
 */
export async function getMaterialPricingRollupSpendRange(input: {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  inventory_location_id?: string | null;
}): Promise<MaterialPricingRollupSpendRow[]> {
  const sb = await supabaseServer();
  const from = input.from;
  const to = input.to;
  const loc = input.inventory_location_id ?? null; // ✅ zostaje jak było (lokalność działa)

  const fn = "pvr_pricing_rollup_spend_range";
  const args = { p_from: from, p_to: to, p_inventory_location_id: loc };

  const { data, error } = await rpcTry(sb, fn, args);
  if (error || !Array.isArray(data)) return [];

  return (data as any[])
    .map((r) => ({
      rollup_key: String(r?.rollup_key ?? ""),
      rollup_label: r?.rollup_label ? String(r.rollup_label) : null,

      unit: r?.unit ?? null,
      wac_unit_price_asof_to: toNum(r?.wac_unit_price_asof_to),

      spent_qty_in_range: toNum(r?.spent_qty_in_range),
      spent_value_in_range: toNum(r?.spent_value_in_range),

      deliveries_count_in_range: toNum(r?.deliveries_count_in_range),
      last_delivery_date_in_range: r?.last_delivery_date_in_range
        ? String(r.last_delivery_date_in_range)
        : null,
    }))
    .filter((x) => x.rollup_key);
}

/**
 * ✅ NEW: tabela dostaw w zakresie dat
 * Źródło prawdy: RPC public.deliveries_range_overview(p_from, p_to, p_inventory_location_id)
 */
export async function getDeliveriesRangeOverview(input: {
  from: string;
  to: string;
  inventory_location_id?: string | null;
}): Promise<DeliveryRangeRow[]> {
  const sb = await supabaseServer();
  const from = input.from;
  const to = input.to;
  const loc = input.inventory_location_id ?? null;

  const { data, error } = await sb.rpc("deliveries_range_overview", {
    p_from: from,
    p_to: to,
    p_inventory_location_id: loc,
  });

  if (error || !Array.isArray(data)) return [];

  return (data as any[])
    .map((r: any) => ({
      delivery_id: String(r?.delivery_id ?? ""),
      delivery_date: String(r?.delivery_date ?? ""),

      inventory_location_id: r?.inventory_location_id
        ? String(r.inventory_location_id)
        : null,
      place_label: r?.place_label ? String(r.place_label) : null,
      supplier: r?.supplier ? String(r.supplier) : null,

      created_at: r?.created_at ? String(r.created_at) : null,
      created_by: r?.created_by ? String(r.created_by) : null,
      created_by_name: r?.created_by_name ? String(r.created_by_name) : null,

      approved: typeof r?.approved === "boolean" ? r.approved : null,
      approved_at: r?.approved_at ? String(r.approved_at) : null,
      approved_by: r?.approved_by ? String(r.approved_by) : null,
      approved_by_name: r?.approved_by_name
        ? String(r.approved_by_name)
        : null,

      delivery_cost: toNum(r?.delivery_cost),
      materials_cost: toNum(r?.materials_cost),
    }))
    .filter((x) => x.delivery_id && x.delivery_date);
}