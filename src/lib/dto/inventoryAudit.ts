// src/lib/dto/inventoryAudit.ts
export type InventoryAuditSessionRow = {
    session_id: string;
    session_date: string | null;
    inventory_location_id: string | null;
  
    // ✅ DB: v_inventory_session_audit(_secure) zwraca person
    person?: string | null;
  
    created_by: string | null;
  
    shrink_value_est: number | null;
    loss_value_est: number | null;
    gain_value_est: number | null;
  };
  
  export type InventoryAuditItemRow = {
    session_id: string;
    material_id: string;
    title: string;
    unit: string | null;
    system_qty: number | null;
    counted_qty: number | null;
    wac_unit_price: number | null;
    delta_value_est: number | null;
  };
  
  export type InventoryAuditDto = {
    sessions: InventoryAuditSessionRow[];
    itemsBySession: Record<string, InventoryAuditItemRow[]>;
  };