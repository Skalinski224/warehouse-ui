// src/lib/queries/pvrSeries.ts
import { supabaseServer } from "@/lib/supabaseServer";
import { toNum } from "@/lib/dto/pvr";

export type PvrSeriesPoint = {
  bucket: string; // YYYY-MM-DD
  value: number;
  count: number;
};

export async function getPurchasesSeries(input: {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  inventory_location_id?: string | null;
  granularity?: "day" | "week" | "month";
}): Promise<PvrSeriesPoint[]> {
  const sb = await supabaseServer();
  const from = input.from;
  const to = input.to;
  const loc = input.inventory_location_id ?? null;

  // obecnie: RPC wspiera day/week — month ogarniamy w UI
  const g = input.granularity === "week" ? "week" : "day";

  const { data, error } = await sb.rpc("pvr_series_purchases", {
    p_from: from,
    p_to: to,
    p_inventory_location_id: loc,
    p_granularity: g,
  });

  if (error || !Array.isArray(data)) return [];

  return (data as any[])
    .map((r) => ({
      bucket: String(r?.bucket ?? ""),
      value: toNum(r?.purchases_value) ?? 0,
      count: toNum(r?.deliveries_count) ?? 0,
    }))
    .filter((x) => x.bucket);
}

export async function getDeliveryCostSeries(input: {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  inventory_location_id?: string | null;
  granularity?: "day" | "week" | "month";
}): Promise<PvrSeriesPoint[]> {
  const sb = await supabaseServer();
  const from = input.from;
  const to = input.to;
  const loc = input.inventory_location_id ?? null;

  // obecnie: RPC wspiera day/week — month ogarniamy w UI
  const g = input.granularity === "week" ? "week" : "day";

  const { data, error } = await sb.rpc("pvr_series_delivery_cost", {
    p_from: from,
    p_to: to,
    p_inventory_location_id: loc,
    p_granularity: g,
  });

  if (error || !Array.isArray(data)) return [];

  return (data as any[])
    .map((r) => ({
      bucket: String(r?.bucket ?? ""),
      value: toNum(r?.delivery_cost_value) ?? 0,
      count: toNum(r?.deliveries_count) ?? 0,
    }))
    .filter((x) => x.bucket);
}