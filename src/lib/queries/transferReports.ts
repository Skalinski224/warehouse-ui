// src/lib/queries/transferReports.ts
import { supabaseServer } from "@/lib/supabaseServer";

export type TransferReportRow = {
  day: string; // timestamptz
  account_id: string;
  created_by: string | null;

  // ✅ nowe (z view)
  created_by_name: string | null;
  created_by_email: string | null;

  from_location_id: string;
  to_location_id: string;
  transfers_count: number;
  qty_total: number | string;
  first_at: string;
  last_at: string;
  items: any; // jsonb (zostawiamy any – nie zgadujemy struktury)
};

export type TransferLogRow = {
  transfer_id: string;
  account_id: string;
  created_at: string;
  created_by: string | null;

  // ✅ nowe (z view)
  created_by_name: string | null;
  created_by_email: string | null;

  from_location_id: string;
  from_location_label: string | null;
  to_location_id: string;
  to_location_label: string | null;

  from_material_id: string;
  from_title: string | null;
  to_material_id: string;
  to_title: string | null;

  qty: number | string;
  note: string | null;

  from_qty_before: number | string | null;
  from_qty_after: number | string | null;
  to_qty_before: number | string | null;
  to_qty_after: number | string | null;
};

function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/**
 * Reports list.
 */
export async function getTransferReportsDayLive(params?: {
  fromDay?: string; // YYYY-MM-DD
  toDay?: string; // YYYY-MM-DD (inclusive)
}) {
  const sb = await supabaseServer();
  const fromDay = params?.fromDay ?? toISODate(new Date(Date.now() - 1000 * 60 * 60 * 24 * 14));
  const toDay = params?.toDay ?? toISODate(new Date());

  // Filter by day range. day is timestamptz at "start of day" in the view.
  const { data, error } = await sb
    .from("v_inventory_transfers_day_live_secure")
    .select(
      [
        "day",
        "account_id",
        "created_by",
        "from_location_id",
        "to_location_id",
        "transfers_count",
        "qty_total",
        "first_at",
        "last_at",
        "items",
        // ✅ nowe
        "created_by_name",
        "created_by_email",
      ].join(",")
    )
    .gte("day", `${fromDay}T00:00:00Z`)
    .lte("day", `${toDay}T23:59:59Z`)
    .order("day", { ascending: false })
    .order("last_at", { ascending: false });

  if (error) {
    console.error("getTransferReportsDayLive error:", error);
    return [] as TransferReportRow[];
  }
  return (data ?? []) as unknown as TransferReportRow[];
}

/**
 * Report details items: use log view (already has labels + qty before/after).
 */
export async function getTransferReportItems(params: {
  day: string; // YYYY-MM-DD
  createdBy: string;
  fromLocationId: string;
  toLocationId: string;
}) {
  const sb = await supabaseServer();

  // IMPORTANT: boundaries depend on how the view groups "day".
  // We use [day, day+1) in UTC to be consistent. If you want Europe/Warsaw day, we’ll adjust.
  const start = `${params.day}T00:00:00Z`;
  // day+1:
  const d = new Date(`${params.day}T00:00:00Z`);
  const endDate = new Date(d.getTime() + 24 * 60 * 60 * 1000);
  const end = endDate.toISOString().slice(0, 10) + "T00:00:00Z";

  const { data, error } = await sb
    .from("v_inventory_transfers_log_secure")
    .select(
      [
        "transfer_id",
        "account_id",
        "created_at",
        "created_by",
        "from_location_id",
        "from_location_label",
        "to_location_id",
        "to_location_label",
        "from_material_id",
        "from_title",
        "to_material_id",
        "to_title",
        "qty",
        "note",
        "from_qty_before",
        "from_qty_after",
        "to_qty_before",
        "to_qty_after",
        // ✅ nowe
        "created_by_name",
        "created_by_email",
      ].join(",")
    )
    .eq("created_by", params.createdBy)
    .eq("from_location_id", params.fromLocationId)
    .eq("to_location_id", params.toLocationId)
    .gte("created_at", start)
    .lt("created_at", end)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getTransferReportItems error:", error);
    return [] as TransferLogRow[];
  }
  return (data ?? []) as unknown as TransferLogRow[];
}