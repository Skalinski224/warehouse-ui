import "server-only";

import type {
  DesignerDashFilters,
  DesignerDashOverviewRow,
  DesignerDashTimeseriesPoint,
} from "@/lib/dto/designerDash";
import { supabaseServer } from "@/lib/supabaseServer";
import { PERM, canAny } from "@/lib/permissions";

/**
 * undefined -> null (RPC lubi null)
 */
function toNull<T>(v: T | undefined | null): T | null {
  return v === undefined ? null : v;
}

function toNum(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function toNullableNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function mapOverviewRow(r: any): DesignerDashOverviewRow {
  return {
    family_key: String(r.family_key),
    rep_title: r.rep_title ?? null,
    planned_qty: toNum(r.planned_qty),
    planned_cost: toNullableNum(r.planned_cost),
    used_qty: toNum(r.used_qty),
    delivered_qty: toNum(r.delivered_qty),
    last_usage_at: r.last_usage_at ?? null,
    last_delivery_at: r.last_delivery_at ?? null,
  };
}

function mapTimeseriesPoint(r: any): DesignerDashTimeseriesPoint {
  return {
    bucket_month: String(r.bucket_month),
    used_qty: toNum(r.used_qty),
    delivered_qty: toNum(r.delivered_qty),
  };
}

/**
 * 🔧 KLUCZ: timeseries nie może iść z (null,null), bo RPC zwraca 0 wierszy.
 * Dajemy sensowny default: ostatnie 12 miesięcy (od 1. dnia miesiąca sprzed 11 mies.)
 */
function withDefaultRange(filters: DesignerDashFilters): DesignerDashFilters {
  if (filters.from_date || filters.to_date) return filters;

  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0); // ostatni dzień bieżącego miesiąca
  const start = new Date(now.getFullYear(), now.getMonth() - 11, 1); // 12 mies wstecz, 1. dzień miesiąca

  const yyyy = (d: Date) => String(d.getFullYear());
  const mm = (d: Date) => String(d.getMonth() + 1).padStart(2, "0");
  const dd = (d: Date) => String(d.getDate()).padStart(2, "0");

  return {
    ...filters,
    from_date: `${yyyy(start)}-${mm(start)}-${dd(start)}`,
    to_date: `${yyyy(end)}-${mm(end)}-${dd(end)}`,
  };
}

/**
 * Permission gate (server-only): jeśli brak uprawnień do metryk/analiz,
 * nie wołamy RPC i zwracamy puste dane.
 */
async function canReadDesignerDash(): Promise<boolean> {
  const supabase = await supabaseServer();

  const { data, error } = await supabase.rpc("my_permissions_snapshot");
  if (error) return false;

  const snapshot = Array.isArray(data) ? data[0] : data;
  if (!snapshot) return false;

  return canAny(snapshot, [PERM.METRICS_READ, PERM.METRICS_MANAGE]);
}

export async function fetchDesignerDashOverview(
  filters: DesignerDashFilters
): Promise<DesignerDashOverviewRow[]> {
  // Gate dostępu (DB może mieć REVOKE EXECUTE na raportach)
  const allowed = await canReadDesignerDash();
  if (!allowed) return [];

  const supabase = await supabaseServer();

  const args = {
    from_date: toNull(filters.from_date),
    to_date: toNull(filters.to_date),
    stage_id: toNull(filters.stage_id),
    place_id: toNull(filters.place_id),
    family: toNull(filters.family),
  };

  const { data, error } = await supabase.rpc("designer_dash_overview_v1", args);

  if (error) {
    throw new Error(
      `fetchDesignerDashOverview: ${error.message ?? "Unknown Supabase error"}`
    );
  }

  if (!data) return [];
  return (data as any[]).map(mapOverviewRow);
}

export async function fetchDesignerDashTimeseries(
  filters: DesignerDashFilters
): Promise<DesignerDashTimeseriesPoint[]> {
  // Gate dostępu (DB może mieć REVOKE EXECUTE na raportach)
  const allowed = await canReadDesignerDash();
  if (!allowed) return [];

  const supabase = await supabaseServer();

  const f = withDefaultRange(filters);

  const args = {
    from_date: toNull(f.from_date),
    to_date: toNull(f.to_date),
    stage_id: toNull(f.stage_id),
    place_id: toNull(f.place_id),
    family: toNull(f.family),
  };

  const { data, error } = await supabase.rpc("designer_dash_timeseries_v1", args);

  if (error) {
    throw new Error(
      `fetchDesignerDashTimeseries: ${error.message ?? "Unknown Supabase error"}`
    );
  }

  if (!data) return [];
  return (data as any[]).map(mapTimeseriesPoint);
}
