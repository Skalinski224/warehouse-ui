// src/lib/queries/inventory.ts
import "server-only";

import { supabaseServer } from "@/lib/supabaseServer";
import { safeQuery } from "@/lib/safeQuery";
import { PERM, canAny } from "@/lib/permissions";

export type InventorySessionsQuery = {
  from?: string | null; // YYYY-MM-DD
  to?: string | null; // YYYY-MM-DD
  q?: string | null; // search in person/description
  approved?: boolean | null; // null = all
  include_deleted?: boolean; // default false
  limit?: number; // default 50
  offset?: number; // default 0
};

export type InventorySessionRow = {
  id: string;
  account_id: string;
  session_date: string;
  created_at: string;
  created_by: string;

  first_name: string | null;
  last_name: string | null;
  person: string | null;

  description: string | null;
  approved: boolean;
  approved_at: string | null;
  approved_by: string | null;

  deleted_at: string | null;
};

export type InventorySessionDetailRow = {
  session_id: string;
  account_id: string;
  session_date: string;
  created_at: string;
  created_by: string;
  description: string | null;

  approved: boolean;
  approved_at: string | null;
  approved_by: string | null;

  deleted_at: string | null;

  item_id: string;
  material_id: string;
  material_title: string;
  material_unit: string | null;
  material_image_url: string | null;

  system_qty: number;
  counted_qty: number | null;
  diff_qty: number | null;

  note: string | null;
};

export type InventorySessionMeta = {
  session_id: string;
  account_id: string;
  session_date: string;
  created_at: string;
  created_by: string;
  description: string | null;
  approved: boolean;
  approved_at: string | null;
  approved_by: string | null;
  deleted_at: string | null;
};

export type InventorySessionDetailsResult = {
  meta: InventorySessionMeta | null;
  items: InventorySessionDetailRow[];
};

function toRange(limit = 50, offset = 0) {
  const l = Math.max(1, Math.min(limit, 200));
  const o = Math.max(0, offset);
  return { from: o, to: o + l - 1 };
}

async function canReadInventoryReports(): Promise<boolean> {
  const supabase = await supabaseServer();

  const { data, error } = await supabase.rpc("my_permissions_snapshot");
  if (error) return false;

  const snapshot = Array.isArray(data) ? data[0] : data;
  if (!snapshot) return false;

  // Raporty inwentaryzacji albo “magazyn/inwentaryzacja” (jak ktoś ma tylko to)
  return canAny(snapshot, [PERM.REPORTS_INVENTORY_READ, PERM.INVENTORY_READ]);
}

/**
 * List inventory sessions from view: v_inventory_sessions_overview
 */
export async function getInventorySessions(params: InventorySessionsQuery = {}) {
  // Permission gate
  const allowed = await canReadInventoryReports();
  if (!allowed) return { rows: [] as InventorySessionRow[], count: 0 };

  const supabase = await supabaseServer();

  const {
    from = null,
    to = null,
    q = null,
    approved = null,
    include_deleted = false,
    limit = 50,
    offset = 0,
  } = params;

  const range = toRange(limit, offset);

  let query = supabase
    .from("v_inventory_sessions_overview")
    .select(
      "id,account_id,session_date,created_at,created_by,first_name,last_name,person,description,approved,approved_at,approved_by,deleted_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(range.from, range.to);

  if (from) query = query.gte("session_date", from);
  if (to) query = query.lte("session_date", to);

  if (approved !== null && approved !== undefined) {
    query = query.eq("approved", approved);
  }

  // ✅ najważniejsze: domyślnie ukrywamy usunięte
  if (!include_deleted) {
    query = query.is("deleted_at", null);
  }

  if (q && q.trim()) {
    const needle = `%${q.trim()}%`;
    query = query.or(`person.ilike.${needle},description.ilike.${needle}`);
  }

  const res = await safeQuery(query);
  return {
    rows: (res.data ?? []) as InventorySessionRow[],
    count: res.count ?? null,
  };
}

/**
 * Session details:
 * - meta ALWAYS fetched from inventory_sessions (so it works even if session has 0 items)
 * - items fetched from v_inventory_session_details
 */
export async function getInventorySessionDetails(sessionId: string) {
  // Permission gate
  const allowed = await canReadInventoryReports();
  if (!allowed) return { meta: null, items: [] as InventorySessionDetailRow[] } satisfies InventorySessionDetailsResult;

  const supabase = await supabaseServer();

  // 1) META (source of truth)
  const metaRes = await safeQuery(
    supabase
      .from("inventory_sessions")
      .select(
        "id,account_id,session_date,created_at,created_by,description,approved,approved_at,approved_by,deleted_at"
      )
      .eq("id", sessionId)
      .limit(1)
      .maybeSingle()
  );

  const metaRow = (metaRes.data ?? null) as
    | {
        id: string;
        account_id: string;
        session_date: string;
        created_at: string;
        created_by: string;
        description: string | null;
        approved: boolean;
        approved_at: string | null;
        approved_by: string | null;
        deleted_at: string | null;
      }
    | null;

  const meta: InventorySessionMeta | null = metaRow
    ? {
        session_id: metaRow.id,
        account_id: metaRow.account_id,
        session_date: metaRow.session_date,
        created_at: metaRow.created_at,
        created_by: metaRow.created_by,
        description: metaRow.description,
        approved: metaRow.approved,
        approved_at: metaRow.approved_at,
        approved_by: metaRow.approved_by,
        deleted_at: metaRow.deleted_at,
      }
    : null;

  // 2) ITEMS
  const itemsRes = await safeQuery(
    supabase
      .from("v_inventory_session_details")
      .select(
        "session_id,account_id,session_date,created_at,created_by,description,approved,approved_at,approved_by,deleted_at,item_id,material_id,material_title,material_unit,material_image_url,system_qty,counted_qty,diff_qty,note"
      )
      .eq("session_id", sessionId)
      .order("material_title", { ascending: true })
  );

  const items = (itemsRes.data ?? []) as InventorySessionDetailRow[];

  return { meta, items } satisfies InventorySessionDetailsResult;
}
