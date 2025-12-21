/**
 * ============================
 * Designer vs Real — DTO
 * ============================
 * Kontrakt danych dla modułu raportowego:
 * /reports/designer-vs-real
 *
 * UWAGA:
 * - Tylko typy
 * - Zero Reacta
 * - Zero logiki
 * - Wszystko, co trafia na frontend, MUSI przejść przez te typy
 */

/**
 * Wiersz overview dashboardu
 * 1 wiersz = 1 family_key (rodzina materiałów w planie)
 * Źródło: designer_dash_overview_v1
 */
export type DesignerDashOverviewRow = {
  /** Klucz rodziny materiałów (np. KABEL_YDY_3x2_5) */
  family_key: string;

  /** Reprezentatywna nazwa materiału (np. min(materials.title)) */
  rep_title: string | null;

  /** Planowana ilość (z designer_plans) */
  planned_qty: number;

  /** Planowany koszt (opcjonalny, jeśli jest liczony) */
  planned_cost: number | null;

  /** Faktyczne zużycie (daily_reports, approved) */
  used_qty: number;

  /** Faktyczne dostawy (delivery_items + deliveries.approved) */
  delivered_qty: number;

  /** Data ostatniego użycia (do tabel / sortów) */
  last_usage_at: string | null;

  /** Data ostatniej dostawy */
  last_delivery_at: string | null;
};

/**
 * Punkt szeregu czasowego (miesięczny bucket)
 * Źródło: designer_dash_timeseries_v1
 */
export type DesignerDashTimeseriesPoint = {
  /** Pierwszy dzień miesiąca (YYYY-MM-01) */
  bucket_month: string;

  /** Zużycie w danym miesiącu */
  used_qty: number;

  /** Dostawy w danym miesiącu */
  delivered_qty: number;
};

/**
 * Filtry dashboardu — sterują URL i RPC
 * To jest JEDYNY obiekt filtrów używany w module
 */
export type DesignerDashFilters = {
  /** Zakres czasu — null = od początku projektu */
  from_date: string | null;
  to_date: string | null;

  /** Opcjonalne zawężenie do etapu projektu */
  stage_id: string | null;

  /** Opcjonalne zawężenie do miejsca (obiektu / lokalizacji) */
  place_id: string | null;

  /** Opcjonalny filtr po rodzinie materiałów */
  family: string | null;
};

/**
 * Dostępne zakładki dashboardu
 * UWAGA: wartości MUSZĄ być spójne z URL (?tab=...)
 */
export type DesignerDashTab =
  | "real"        // Zużycie (Real)
  | "supply"      // Dostawy
  | "deviations"  // Odchylenia / ryzyka
  | "material";   // Widok szczegółowy materiału
