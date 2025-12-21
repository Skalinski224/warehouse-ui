// src/lib/dto/metrics.ts
// DTO — Metrics (Mission Control)
//
// Ten plik jest “kontraktem” frontu dla /analyze/metrics.
// Trzymamy tu typy w jednym miejscu, żeby komponenty były czyste i przewidywalne.
//
// Uwaga: `top_usage` przychodzi z SQL jako jsonb → w TS traktujemy jako tablicę obiektów.

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

  // Nowe pola:
  costs_by_bucket: { bucket: string; deliveries_cost: number; usage_cost: number }[]; // Koszty per bucket
  cumulative_costs_by_bucket: { bucket: string; cumulative_deliveries_cost: number; cumulative_usage_cost: number }[]; // Narastające koszty
};

export const EMPTY_PROJECT_METRICS_DASH: ProjectMetricsDashRow = {
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
