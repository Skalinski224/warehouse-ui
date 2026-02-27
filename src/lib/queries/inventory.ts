// src/lib/queries/inventory.ts
import "server-only";

import { supabaseServer } from "@/lib/supabaseServer";
import { safeQuery } from "@/lib/safeQuery";
import { PERM, canAny } from "@/lib/permissions";

export type InventorySessionsQuery = {
  gate?: "inventory" | "reports"; // domyślnie inventory
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

  // ⚠️ te pola mogą być null, bo view może ich nie mieć (fallback)
  created_by: string | null;

  person: string | null;

  description: string | null;
  approved: boolean;

  approved_at: string | null;
  approved_by: string | null;

  deleted_at: string | null;

  inventory_location_id: string | null;
  inventory_location_label: string | null;

  items_count: number | null;
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

  inventory_location_id: string | null;
  inventory_location_label: string | null;
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

async function canReadInventoryModule(): Promise<boolean> {
  const supabase = await supabaseServer();

  const { data, error } = await supabase.rpc("my_permissions_snapshot");
  if (error) return false;

  const snapshot: any = Array.isArray(data) ? data[0] : data;
  if (!snapshot) return false;

  const role = (snapshot?.role ?? null) as string | null;
  if (role === "worker" || role === "foreman") return false;

  // legacy fallback (na czas przejścia)
  const roleOk = role === "owner" || role === "manager" || role === "storeman";
  if (roleOk) return true;

  return canAny(snapshot, [PERM.INVENTORY_READ, PERM.INVENTORY_MANAGE]);
}

async function canReadInventoryReports(): Promise<boolean> {
  const supabase = await supabaseServer();

  const { data, error } = await supabase.rpc("my_permissions_snapshot");
  if (error) return false;

  const snapshot: any = Array.isArray(data) ? data[0] : data;
  if (!snapshot) return false;

  const role = (snapshot?.role ?? null) as string | null;
  if (role === "worker" || role === "foreman") return false;

  return canAny(snapshot, [PERM.REPORTS_INVENTORY_READ]);
}

function applySessionFilters(
  qb: any,
  params: InventorySessionsQuery,
  opts?: { has_deleted_at?: boolean }
) {
  const {
    from = null,
    to = null,
    q = null,
    approved = null,
    include_deleted = false,
  } = params;

  if (from) qb = qb.gte("session_date", from);
  if (to) qb = qb.lte("session_date", to);

  if (approved !== null && approved !== undefined) {
    qb = qb.eq("approved", approved);
  }

  // ⚠️ deleted_at może nie istnieć w view -> filtrujemy tylko jeśli jest
  if (opts?.has_deleted_at && !include_deleted) {
    qb = qb.is("deleted_at", null);
  }

  if (q && q.trim()) {
    const needle = `%${q.trim()}%`;
    qb = qb.or(`person.ilike.${needle},description.ilike.${needle}`);
  }

  return qb;
}

/**
 * List inventory sessions from view: v_inventory_sessions_overview
 * - fallbackuje na minimalny select, jeśli view nie ma meta-kolumn (created_by, deleted_at, approved_at...)
 * - zwraca error do UI, żebyś nie miał "pustej listy" bez przyczyny
 */
export async function getInventorySessions(params: InventorySessionsQuery = {}) {
  const gate = params.gate ?? "inventory";
  const allowed =
    gate === "reports"
      ? await canReadInventoryReports()
      : await canReadInventoryModule();

  if (!allowed) {
    return { rows: [] as InventorySessionRow[], count: 0, error: null as string | null };
  }

  const supabase = await supabaseServer();
  const { limit = 50, offset = 0 } = params;
  const range = toRange(limit, offset);

  // 1) Prefer: pełny zestaw (jeśli view jest “bogate”)
  let q1: any = supabase.from("v_inventory_sessions_overview").select(
    [
      "id,account_id,session_date,created_at,created_by",
      "description,approved,approved_at,approved_by,deleted_at",
      "inventory_location_id,inventory_location_label",
      "person",
      "items_count",
    ].join(","),
    { count: "exact" }
  );

  q1 = applySessionFilters(q1, params, { has_deleted_at: true })
    .order("created_at", { ascending: false })
    .range(range.from, range.to);

  const res1: any = await safeQuery(q1);
  if (!res1?.error) {
    return {
      rows: (res1.data ?? []) as InventorySessionRow[],
      count: res1.count ?? null,
      error: null as string | null,
    };
  }

  // 2) Fallback: bez lokacji/meta (stare/uboższe view) — nadal zakłada deleted_at
  let q2: any = supabase.from("v_inventory_sessions_overview").select(
    [
      "id,account_id,session_date,created_at,created_by",
      "description,approved,approved_at,approved_by,deleted_at",
      "person",
      "items_count",
    ].join(","),
    { count: "exact" }
  );

  q2 = applySessionFilters(q2, params, { has_deleted_at: true })
    .order("created_at", { ascending: false })
    .range(range.from, range.to);

  const res2: any = await safeQuery(q2);
  if (!res2?.error) {
    return {
      rows: ((res2.data ?? []) as any[]).map((r) => ({
        ...r,
        inventory_location_id: (r as any).inventory_location_id ?? null,
        inventory_location_label: (r as any).inventory_location_label ?? null,
        items_count: (r as any).items_count ?? null,
      })) as InventorySessionRow[],
      count: res2.count ?? null,
      error: null as string | null,
    };
  }

  // 3) HARD FALLBACK: minimalny zestaw dokładnie jak Twoje view (#4)
  let q3: any = supabase.from("v_inventory_sessions_overview").select(
    [
      "id,account_id,session_date,description,approved,created_at",
      "inventory_location_id,inventory_location_label",
      "person",
      "items_count",
    ].join(","),
    { count: "exact" }
  );

  // ⚠️ tu NIE dotykamy deleted_at, bo kolumny nie ma
  q3 = applySessionFilters(q3, params, { has_deleted_at: false })
    .order("created_at", { ascending: false })
    .range(range.from, range.to);

  const res3: any = await safeQuery(q3);
  if (!res3?.error) {
    const mapped = ((res3.data ?? []) as any[]).map((r) => ({
      id: String(r.id),
      account_id: String(r.account_id),
      session_date: String(r.session_date),
      created_at: String(r.created_at),

      created_by: null, // brak w view
      approved_at: null, // brak w view
      approved_by: null, // brak w view
      deleted_at: null, // brak w view

      description: (r.description ?? null) as string | null,
      approved: Boolean(r.approved),

      inventory_location_id: (r.inventory_location_id ?? null) as string | null,
      inventory_location_label: (r.inventory_location_label ?? null) as string | null,

      person: (r.person ?? null) as string | null,
      items_count: (r.items_count ?? null) as number | null,
    })) as InventorySessionRow[];

    return {
      rows: mapped,
      count: res3.count ?? null,
      error: null as string | null,
    };
  }

  // jeśli wszystkie 3 padły -> zwracamy błąd do UI
  const msg = String(res1?.error?.message ?? res2?.error?.message ?? res3?.error?.message ?? "Unknown error");
  return { rows: [] as InventorySessionRow[], count: 0, error: msg };
}

/**
 * Session details:
 * - meta ALWAYS fetched from inventory_sessions (so it works even if session has 0 items)
 * - items fetched from v_inventory_session_details
 */
export async function getInventorySessionDetails(
  sessionId: string,
  opts?: { gate?: "inventory" | "reports" }
) {
  const gate = opts?.gate ?? "inventory";
  const allowed =
    gate === "reports"
      ? await canReadInventoryReports()
      : await canReadInventoryModule();

  if (!allowed)
    return {
      meta: null,
      items: [] as InventorySessionDetailRow[],
    } satisfies InventorySessionDetailsResult;

  const supabase = await supabaseServer();

  const metaRes: any = await safeQuery(
    supabase
      .from("inventory_sessions")
      .select(
        "id,account_id,session_date,created_at,created_by,description,approved,approved_at,approved_by,deleted_at,inventory_location_id"
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
        inventory_location_id: string | null;
      }
    | null;

  let inventory_location_label: string | null = null;
  if (metaRow?.inventory_location_id) {
    const locRes: any = await safeQuery(
      supabase
        .from("inventory_locations")
        .select("label,deleted_at")
        .eq("id", metaRow.inventory_location_id)
        .is("deleted_at", null)
        .limit(1)
        .maybeSingle()
    );
    inventory_location_label = (locRes.data as any)?.label
      ? String((locRes.data as any).label)
      : null;
  }

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
        inventory_location_id: metaRow.inventory_location_id,
        inventory_location_label,
      }
    : null;

  const itemsRes: any = await safeQuery(
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