// src/lib/queries/inventoryDelta.ts

import { supabaseServer } from "@/lib/supabaseServer";
import {
  toNum,
  clamp0,
  safeMul,
  type InventoryDeltaRow,
} from "@/lib/dto/inventoryDelta";

export async function getLatestInventoryDeltas(input?: {
  inventory_location_id?: string | null;
  limit?: number; // ile pozycji (nie sesji)
}): Promise<InventoryDeltaRow[]> {
  const sb = await supabaseServer();
  const loc = input?.inventory_location_id ?? null;
  const limit = input?.limit ?? 50;

  /**
   * Bierzemy inventory_items + sesja (date) + materials (title/unit).
   * Potem dociągamy WAC z v_material_pricing_by_location_now_secure (NOW).
   *
   * UWAGA: nazwy qty w inventory_items są niepewne => fallbacki.
   */
  let q = sb
    .from("inventory_items")
    .select(
      `
      session_id,
      inventory_location_id,
      system_qty,
      expected_qty,
      system_quantity,
      qty_system,
      counted_qty,
      measured_qty,
      counted_quantity,
      quantity_counted,
      qty_counted,
      material_id,
      sessions:inventory_sessions ( session_date ),
      materials:materials ( title, unit )
    `
    )
    .order("created_at", { ascending: false })
    .limit(500); // bierzemy większy set i potem tniemy po delta != 0

  if (loc) q = q.eq("inventory_location_id", loc);

  const { data, error } = await q;
  if (error || !Array.isArray(data) || data.length === 0) return [];

  // Pricing map (material_id + loc) -> wac
  const { data: pData, error: pErr } = await sb
    .from("v_material_pricing_by_location_now_secure")
    .select("material_id, inventory_location_id, wac_unit_price");

  const pricingMap = new Map<string, number | null>();
  if (!pErr && Array.isArray(pData)) {
    for (const x of pData as any[]) {
      const mid = String(x?.material_id ?? "");
      if (!mid) continue;
      const l = x?.inventory_location_id ? String(x.inventory_location_id) : null;
      pricingMap.set(`${mid}:${l ?? "null"}`, toNum(x?.wac_unit_price));
    }
  }

  const rows: InventoryDeltaRow[] = [];

  for (const r of data as any[]) {
    const sessionId = String(r?.session_id ?? "");
    const materialId = String(r?.material_id ?? "");
    if (!sessionId || !materialId) continue;

    const invLoc = r?.inventory_location_id ? String(r.inventory_location_id) : null;

    const systemQty =
      toNum(r?.system_qty) ??
      toNum(r?.expected_qty) ??
      toNum(r?.system_quantity) ??
      toNum(r?.qty_system) ??
      null;

    const countedQty =
      toNum(r?.counted_qty) ??
      toNum(r?.measured_qty) ??
      toNum(r?.counted_quantity) ??
      toNum(r?.quantity_counted) ??
      toNum(r?.qty_counted) ??
      null;

    if (typeof systemQty !== "number" || typeof countedQty !== "number") continue;

    const delta = countedQty - systemQty;
    if (delta === 0) continue;

    const lossQty = clamp0(systemQty - countedQty); // tylko gdy ubyło
    const wac = pricingMap.get(`${materialId}:${invLoc ?? "null"}`) ?? null;
    const lossValue = safeMul(lossQty, wac);

    rows.push({
      session_id: sessionId,
      session_date: r?.sessions?.session_date ? String(r.sessions.session_date) : null,
      inventory_location_id: invLoc,
      material_id: materialId,
      title: r?.materials?.title ? String(r.materials.title) : "—",
      unit: r?.materials?.unit ? String(r.materials.unit) : null,
      system_qty: systemQty,
      counted_qty: countedQty,
      loss_qty: lossQty,
      wac_unit_price: wac,
      loss_value: lossValue,
    });
  }

  // sort: najnowsze + największa strata
  rows.sort((a, b) => (b.loss_value ?? 0) - (a.loss_value ?? 0));

  return rows.slice(0, limit);
}
