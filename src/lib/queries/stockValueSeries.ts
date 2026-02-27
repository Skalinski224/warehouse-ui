// src/lib/queries/stockValueSeries.ts
import { supabaseServer } from "@/lib/supabaseServer";
import { PERM, can } from "@/lib/permissions";

export type StockValuePoint = {
  bucket: string; // YYYY-MM-DD
  stock_value_est: number | null;
  stock_qty_now: number | null;
};

function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

async function getSnapshot() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("my_permissions_snapshot");
  if (error) return null;
  return Array.isArray(data) ? (data[0] ?? null) : (data ?? null);
}

function sameDay(a: string, b: string): boolean {
  return String(a).slice(0, 10) === String(b).slice(0, 10);
}

export async function getStockValueSeries(input: {
  from: string;
  to: string;
  inventory_location_id?: string | null;
}): Promise<StockValuePoint[]> {
  const snapshot = await getSnapshot();
  if (!can(snapshot, PERM.MATERIALS_READ)) return [];

  const sb = await supabaseServer();
  const from = input.from;
  const to = input.to;
  const loc = input.inventory_location_id ?? null;

  // 1) seria z inventory_value_series
  const { data, error } = await sb.rpc("inventory_value_series", {
    p_from: from,
    p_to: to,
    p_inventory_location_id: loc,
  });

  const series: StockValuePoint[] = Array.isArray(data)
    ? (data as any[])
        .map((r: any) => ({
          bucket: String(r?.day ?? ""),
          stock_value_est: toNum(r?.stock_value_est),
          stock_qty_now: toNum(r?.stock_qty_now),
        }))
        .filter((x) => x.bucket)
    : [];

  // 2) “TERAZ” z tego samego źródła co karta: pvr_summary_overview.totals.stock_value_now_est
  const { data: nowData } = await sb.rpc("pvr_summary_overview", {
    p_from: from,
    p_to: to,
    p_inventory_location_id: loc,
  });

  const nowObj =
    Array.isArray(nowData) ? (nowData[0] ?? null) : (nowData && typeof nowData === "object" ? nowData : null);

  const totals = (nowObj as any)?.totals ?? nowObj ?? null;

  const nowValue = toNum(totals?.stock_value_now_est);
  const nowQty = toNum(totals?.stock_qty_now);

  // jeśli nie ma wartości “teraz”, nie doklejamy nic (nie zgadujemy)
  if (nowValue === null && nowQty === null) return series;

  const last = series.length > 0 ? series[series.length - 1] : null;
  const shouldAppend = !last || !sameDay(last.bucket, to);

  if (shouldAppend) {
    series.push({
      bucket: to,
      stock_value_est: nowValue,
      stock_qty_now: nowQty,
    });
  } else {
    // jeśli ostatni punkt jest na “to”, to nadpisz go “prawdą” z pvr_summary_overview
    series[series.length - 1] = {
      bucket: to,
      stock_value_est: nowValue ?? series[series.length - 1].stock_value_est,
      stock_qty_now: nowQty ?? series[series.length - 1].stock_qty_now,
    };
  }

  return series;
}
