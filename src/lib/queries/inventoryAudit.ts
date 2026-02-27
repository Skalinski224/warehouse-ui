// src/lib/queries/inventoryAudit.ts
import { supabaseServer } from "@/lib/supabaseServer";
import { toNum } from "@/lib/dto/pvr";
import type {
  InventoryAuditDto,
  InventoryAuditItemRow,
  InventoryAuditSessionRow,
} from "@/lib/dto/inventoryAudit";

export async function getInventoryAudit(input?: {
  from?: string;
  to?: string;
  inventory_location_id?: string | null;
}): Promise<InventoryAuditDto> {
  const sb = await supabaseServer();
  const loc = input?.inventory_location_id ?? null;

  const { data: sData, error: sErr } = await sb
    .from("v_inventory_session_audit_secure")
    .select(
      "session_id, session_date, inventory_location_id, created_by, person, shrink_value_est, loss_value_est, gain_value_est"
    )
    .order("session_date", { ascending: false });

  if (sErr || !Array.isArray(sData)) return { sessions: [], itemsBySession: {} };

  let sessions: InventoryAuditSessionRow[] = (sData as any[])
    .map((r) => ({
      session_id: String(r?.session_id ?? ""),
      session_date: r?.session_date ? String(r.session_date) : null,
      inventory_location_id: r?.inventory_location_id
        ? String(r.inventory_location_id)
        : null,

      person: r?.person ? String(r.person) : null,

      created_by: r?.created_by ? String(r.created_by) : null,
      shrink_value_est: toNum(r?.shrink_value_est),
      loss_value_est: toNum(r?.loss_value_est),
      gain_value_est: toNum(r?.gain_value_est),
    }))
    .filter((x) => x.session_id);

  // filtr zakresu (opcjonalny)
  const from = input?.from ?? null;
  const to = input?.to ?? null;
  if (from) sessions = sessions.filter((x) => (x.session_date ?? "") >= from);
  if (to) sessions = sessions.filter((x) => (x.session_date ?? "") <= to);
  if (loc)
    sessions = sessions.filter(
      (x) => (x.inventory_location_id ?? null) === loc
    );

  const sessionIds = sessions.map((s) => s.session_id);
  if (sessionIds.length === 0) return { sessions: [], itemsBySession: {} };

  const { data: iData, error: iErr } = await sb
    .from("v_inventory_session_audit_items_secure")
    .select(
      "session_id, material_id, title, unit, system_qty, counted_qty, wac_unit_price, delta_value_est"
    )
    .in("session_id", sessionIds);

  const itemsBySession: Record<string, InventoryAuditItemRow[]> = {};
  if (!iErr && Array.isArray(iData)) {
    for (const r of iData as any[]) {
      const sid = String(r?.session_id ?? "");
      if (!sid) continue;

      const row: InventoryAuditItemRow = {
        session_id: sid,
        material_id: String(r?.material_id ?? ""),
        title: String(r?.title ?? "—"),
        unit: r?.unit ? String(r.unit) : null,
        system_qty: toNum(r?.system_qty),
        counted_qty: toNum(r?.counted_qty),
        wac_unit_price: toNum(r?.wac_unit_price),
        delta_value_est: toNum(r?.delta_value_est),
      };
      if (!row.material_id) continue;

      (itemsBySession[sid] ??= []).push(row);
    }
  }

  // sort: największa zmiana na górze (po abs)
  for (const sid of Object.keys(itemsBySession)) {
    itemsBySession[sid].sort(
      (a, b) =>
        Math.abs(b.delta_value_est ?? 0) - Math.abs(a.delta_value_est ?? 0)
    );
  }

  return { sessions, itemsBySession };
}