// src/lib/dto/inventoryDelta.ts

export type InventoryDeltaRow = {
    session_id: string;
    session_date: string | null;
  
    inventory_location_id: string | null;
  
    material_id: string;
    title: string;
    unit: string | null;
  
    system_qty: number | null;
    counted_qty: number | null;
  
    loss_qty: number | null; // max(0, system - counted)
    wac_unit_price: number | null;
    loss_value: number | null; // loss_qty * wac
  };
  
  export function toNum(v: unknown): number | null {
    if (v === null || v === undefined) return null;
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const n = Number(v.replace(",", "."));
      return Number.isFinite(n) ? n : null;
    }
    return null;
  }
  
  export function clamp0(n: number): number {
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }
  
  export function safeMul(a: number | null, b: number | null): number | null {
    if (typeof a !== "number" || !Number.isFinite(a)) return null;
    if (typeof b !== "number" || !Number.isFinite(b)) return null;
    return a * b;
  }
  