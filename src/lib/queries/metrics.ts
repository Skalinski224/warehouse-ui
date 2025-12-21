// src/lib/queries/metrics.ts
// Queries — Metrics (Mission Control)
//
// Cel:
// - jedno miejsce na pobieranie danych do /analyze/metrics
// - BEZ crashy: zawsze zwracamy sensowny fallback
// - multi-tenant: opieramy się o RLS + supabaseServer()
// - gotowe pod przyszłe time-series RPC (kolejne funkcje dopiszemy tu później)

import { supabaseServer } from "@/lib/supabaseServer";
import { PERM, canAny } from "@/lib/permissions";

export type TopUsageItem = {
  material_id: string;
  name: string;
  qty_used: number;
  est_cost?: number;
};

export type ProjectMetricsDashRow = {
  materials_cost_total: number;
  delivery_cost_total: number;
  usage_qty_total: number;
  usage_cost_total: number;
  daily_reports_count: number;
  pending_reports_count: number;
  avg_approval_hours: number;
  low_stock_count: number;
  within_plan_count: number;
  over_plan_count: number;
  top_usage: TopUsageItem[];

  costs_by_bucket: { bucket: string; deliveries_cost: number; usage_cost: number }[];
  cumulative_costs_by_bucket: {
    bucket: string;
    cumulative_deliveries_cost: number;
    cumulative_usage_cost: number;
  }[];
};

type GetProjectMetricsDashArgs = {
  from?: string | null;
  to?: string | null;
  place?: string | null;
};

function toNumber(v: unknown, fallback = 0): number {
  if (v === null || v === undefined) return fallback;
  if (typeof v === "number") return Number.isFinite(v) ? v : fallback;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function asString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v;
  return String(v);
}

function safeArray(v: unknown): any[] {
  if (Array.isArray(v)) return v;
  return [];
}

function safeTopUsage(v: unknown): TopUsageItem[] {
  const arr = safeArray(v);
  return arr
    .map((x: any) => ({
      material_id: asString(x?.material_id) ?? "",
      name: asString(x?.name) ?? "—",
      qty_used: toNumber(x?.qty_used, 0),
      est_cost:
        x?.est_cost === null || x?.est_cost === undefined
          ? undefined
          : toNumber(x?.est_cost, 0),
    }))
    .filter((x) => x.material_id);
}

function emptyDash(): ProjectMetricsDashRow {
  return {
    materials_cost_total: 0,
    delivery_cost_total: 0,
    usage_qty_total: 0,
    usage_cost_total: 0,
    daily_reports_count: 0,
    pending_reports_count: 0,
    avg_approval_hours: 0,
    low_stock_count: 0,
    within_plan_count: 0,
    over_plan_count: 0,
    top_usage: [],
    costs_by_bucket: [],
    cumulative_costs_by_bucket: [],
  };
}

// Minimalny gate na metryki: nie wołamy RPC jeśli brak permission.
async function canReadMetrics(): Promise<boolean> {
  const supabase = await supabaseServer();

  const { data, error } = await supabase.rpc("my_permissions_snapshot");
  if (error) {
    // jeśli snapshot nie działa, traktujemy jak brak dostępu (bez crashy)
    return false;
  }

  const snapshot = Array.isArray(data) ? data[0] : data;
  if (!snapshot) return false;

  return canAny(snapshot, [PERM.METRICS_READ, PERM.METRICS_MANAGE]);
}

/**
 * getProjectMetricsDash
 * - RPC: project_metrics_dash_v1(from_date, to_date, place)
 * - Zwraca zawsze 1 obiekt (nawet jak brak danych / error)
 */
export async function getProjectMetricsDash(
  args: GetProjectMetricsDashArgs = {}
): Promise<ProjectMetricsDashRow> {
  // Permission gate (DB może mieć REVOKE EXECUTE na metrykach)
  const allowed = await canReadMetrics();
  if (!allowed) return emptyDash();

  const supabase = await supabaseServer();

  const payload = {
    from_date: args.from ?? null,
    to_date: args.to ?? null,
    place: args.place ?? null,
  };

  const { data, error } = await supabase.rpc("project_metrics_dash_v1", payload);

  if (error) {
    console.error("[metrics] project_metrics_dash_v1 rpc error:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return emptyDash();
  }

  const row = Array.isArray(data) ? data[0] : data;

  if (!row) return emptyDash();

  // Normalizacja
  return {
    materials_cost_total: toNumber(row.materials_cost_total, 0),
    delivery_cost_total: toNumber(row.delivery_cost_total, 0),
    usage_qty_total: toNumber(row.usage_qty_total, 0),
    usage_cost_total: toNumber(row.usage_cost_total, 0),
    daily_reports_count: toNumber(row.daily_reports_count, 0),
    pending_reports_count: toNumber(row.pending_reports_count, 0),
    avg_approval_hours: toNumber(row.avg_approval_hours, 0),
    low_stock_count: toNumber(row.low_stock_count, 0),
    within_plan_count: toNumber(row.within_plan_count, 0),
    over_plan_count: toNumber(row.over_plan_count, 0),
    top_usage: safeTopUsage(row.top_usage),
    costs_by_bucket: safeArray(row.costs_by_bucket),
    cumulative_costs_by_bucket: safeArray(row.cumulative_costs_by_bucket),
  };
}
