// src/app/(app)/inventory/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabaseServer";
import type { PermissionSnapshot } from "@/lib/permissions";

/* ----------------------------- helpers ----------------------------- */

function assertUuid(v: unknown, name: string) {
  if (
    typeof v !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v
    )
  ) {
    throw new Error(`${name} must be a valid uuid`);
  }
  return v;
}

function toNumberOrNull(v: unknown) {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return n;
}

function logRpcError(tag: string, error: any) {
  console.error(tag, {
    code: error?.code,
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
  });
}

function unwrapSnapshot(data: unknown): PermissionSnapshot | null {
  if (Array.isArray(data)) return (data[0] as PermissionSnapshot) ?? null;
  return (data as PermissionSnapshot) ?? null;
}

function isInventoryRole(role: string | null): boolean {
  return role === "owner" || role === "manager" || role === "storeman";
}

/**
 * ✅ Inventory access gate (server truth).
 * Worker + foreman: zero dostępu do modułu.
 * Wpuszczamy: owner/manager/storeman (fallback).
 */
async function assertInventoryAccess() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("my_permissions_snapshot");
  const snap = unwrapSnapshot(data);

  if (error || !snap) throw new Error("Brak uprawnień");
  if (snap.role === "worker" || snap.role === "foreman") throw new Error("Brak uprawnień");

  // fallback rolowy (docelowo możesz tu dodać can(snap, PERM.INVENTORY_READ))
  if (!isInventoryRole(snap.role)) throw new Error("Brak uprawnień");

  return supabase;
}

/**
 * Revalidate inventory routes.
 * - /inventory: lista draftów
 * - /inventory/new: kreator + edycja (query param session)
 * - /inventory/[id]/summary: podsumowanie
 */
function revalidateInventory(sessionId?: string) {
  revalidatePath("/inventory");
  revalidatePath("/inventory/new");

  if (sessionId) {
    revalidatePath(`/inventory/${sessionId}`);
    revalidatePath(`/inventory/${sessionId}/summary`);
  }
}

/* ----------------------------- actions / rpc ----------------------------- */

/** RPC: create_inventory_session(date, text) -> uuid */
export async function createInventorySession(params: {
  session_date?: string | null; // YYYY-MM-DD
  description?: string | null;
}) {
  const supabase = await assertInventoryAccess();

  const session_date =
    params.session_date && params.session_date.trim() ? params.session_date.trim() : null;

  const description =
    params.description && params.description.trim() ? params.description.trim() : null;

  const { data, error } = await supabase.rpc("create_inventory_session", {
    p_session_date: session_date,
    p_description: description,
  });

  if (error) {
    logRpcError("[createInventorySession] RPC error", error);
    throw new Error(error.message ?? "Failed to create inventory session");
  }

  const sessionId = String(data || "");
  if (!sessionId) throw new Error("create_inventory_session did not return id");

  revalidateInventory(sessionId);
  return { sessionId };
}

/**
 * ✅ Dodaj wszystkie przedmioty z magazynu — TYLKO aktywne (nieusunięte).
 * Nie polegamy na RPC inventory_add_all_items (bo mogło dodać usunięte).
 * Lecimy po aktywnych materiałach i wołamy inventory_add_item(session, material).
 */
export async function inventoryAddAllItems(sessionId: string) {
  assertUuid(sessionId, "sessionId");
  const supabase = await assertInventoryAccess();

  // bierzemy tylko aktywne materiały
  const { data: mats, error: matsErr } = await supabase
    .from("v_materials_active")
    .select("id")
    .order("title", { ascending: true })
    .limit(5000);

  if (matsErr) {
    // fallback: jeśli view nie istnieje (np. przed migracją)
    console.warn("[inventoryAddAllItems] v_materials_active missing, fallback -> materials", matsErr);
    const { data: mats2, error: mats2Err } = await supabase
      .from("materials")
      .select("id,deleted_at")
      .is("deleted_at", null)
      .order("title", { ascending: true })
      .limit(5000);

    if (mats2Err) {
      logRpcError("[inventoryAddAllItems] materials query error", mats2Err);
      throw new Error(mats2Err.message ?? "Failed to load active materials");
    }

    return await addAllByRpcLoop(supabase, sessionId, (mats2 ?? []).map((r: any) => String(r.id)));
  }

  return await addAllByRpcLoop(supabase, sessionId, (mats ?? []).map((r: any) => String(r.id)));
}

async function addAllByRpcLoop(supabase: any, sessionId: string, materialIds: string[]) {
  let inserted = 0;

  // chunkujemy, żeby nie ubić połączenia
  const CHUNK = 40;
  for (let i = 0; i < materialIds.length; i += CHUNK) {
    const part = materialIds.slice(i, i + CHUNK);

    // równolegle w małym chunku
    const results = await Promise.all(
      part.map(async (materialId) => {
        const { error } = await supabase.rpc("inventory_add_item", {
          p_session_id: sessionId,
          p_material_id: materialId,
        });
        if (error) {
          // nie przerywamy całości — często to duplikat/konflikt
          return false;
        }
        return true;
      })
    );

    inserted += results.filter(Boolean).length;
  }

  revalidateInventory(sessionId);
  return { inserted };
}

/** RPC: inventory_add_item(uuid, uuid) -> void */
export async function inventoryAddItem(sessionId: string, materialId: string) {
  assertUuid(sessionId, "sessionId");
  assertUuid(materialId, "materialId");
  const supabase = await assertInventoryAccess();

  // safety: nie pozwól dodać usuniętego (sprawdzamy w v_materials_active)
  const { data: okRow, error: okErr } = await supabase
    .from("v_materials_active")
    .select("id")
    .eq("id", materialId)
    .limit(1)
    .maybeSingle();

  if (okErr) {
    // jeśli view jeszcze nie ma — fallback
    const { data: okRow2, error: okErr2 } = await supabase
      .from("materials")
      .select("id,deleted_at")
      .eq("id", materialId)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();

    if (okErr2 || !okRow2) throw new Error("Nie można dodać usuniętego materiału.");
  } else if (!okRow) {
    throw new Error("Nie można dodać usuniętego materiału.");
  }

  const { error } = await supabase.rpc("inventory_add_item", {
    p_session_id: sessionId,
    p_material_id: materialId,
  });

  if (error) {
    logRpcError("[inventoryAddItem] RPC error", error);
    throw new Error(error.message ?? "Failed to add item");
  }

  revalidateInventory(sessionId);
  return { ok: true };
}

/** RPC: inventory_set_counted_qty(uuid, uuid, numeric|null) -> void */
export async function inventorySetCountedQty(
  sessionId: string,
  materialId: string,
  countedQty: unknown
) {
  assertUuid(sessionId, "sessionId");
  assertUuid(materialId, "materialId");

  const qty = toNumberOrNull(countedQty);
  const supabase = await assertInventoryAccess();

  const { error } = await supabase.rpc("inventory_set_counted_qty", {
    p_session_id: sessionId,
    p_material_id: materialId,
    p_counted_qty: qty,
  });

  if (error) {
    logRpcError("[inventorySetCountedQty] RPC error", error);
    throw new Error(error.message ?? "Failed to set counted qty");
  }

  revalidateInventory(sessionId);
  return { ok: true };
}

/** RPC: inventory_remove_item(uuid, uuid) -> void */
export async function inventoryRemoveItem(sessionId: string, materialId: string) {
  assertUuid(sessionId, "sessionId");
  assertUuid(materialId, "materialId");
  const supabase = await assertInventoryAccess();

  const { error } = await supabase.rpc("inventory_remove_item", {
    p_session_id: sessionId,
    p_material_id: materialId,
  });

  if (error) {
    logRpcError("[inventoryRemoveItem] RPC error", error);
    throw new Error(error.message ?? "Failed to remove item");
  }

  revalidateInventory(sessionId);
  return { ok: true };
}

/** RPC: delete_inventory_session(uuid) -> void */
export async function deleteInventorySession(sessionId: string) {
  assertUuid(sessionId, "sessionId");
  const supabase = await assertInventoryAccess();

  const { error } = await supabase.rpc("delete_inventory_session", {
    p_session_id: sessionId,
  });

  if (error) {
    logRpcError("[deleteInventorySession] RPC error", error);
    throw new Error(error.message ?? "Failed to delete inventory session");
  }

  revalidateInventory(sessionId);
  return { ok: true };
}

/** RPC: approve_inventory_session(uuid) -> void */
export async function approveInventorySession(sessionId: string) {
  assertUuid(sessionId, "sessionId");
  const supabase = await assertInventoryAccess();

  const { error } = await supabase.rpc("approve_inventory_session", {
    p_session_id: sessionId,
  });

  if (error) {
    logRpcError("[approveInventorySession] RPC error", error);
    throw new Error(error.message ?? "Failed to approve inventory session");
  }

  revalidateInventory(sessionId);

  revalidatePath("/materials");
  revalidatePath("/low-stock");
  revalidatePath("/reports/inventory");

  return { ok: true };
}

/**
 * ✅ Server Action: wyszukiwarka materiałów dla InventoryEditor (client).
 * Tylko aktywne (nieusunięte) — przez v_materials_active.
 */
export async function inventorySearchMaterials(q: string) {
  const supabase = await assertInventoryAccess();

  const needle = (q ?? "").trim();

  // Prefer: v_materials_active
  let query = supabase
    .from("v_materials_active")
    .select("id,title,unit")
    .order("title", { ascending: true })
    .limit(20);

  if (needle) query = query.ilike("title", `%${needle}%`);

  const { data, error } = await query;
  if (error) {
    // fallback: jeśli view nie istnieje
    const fb = supabase
      .from("materials")
      .select("id,title,unit,deleted_at")
      .is("deleted_at", null)
      .order("title", { ascending: true })
      .limit(20);

    const fb2 = needle ? fb.ilike("title", `%${needle}%`) : fb;

    const { data: data2, error: error2 } = await fb2;

    if (error2) {
      logRpcError("[inventorySearchMaterials] query error", error2);
      throw new Error(error2.message ?? "Failed to search materials");
    }

    return {
      rows: (data2 ?? []).map((m: any) => ({
        id: m.id,
        title: m.title,
        unit: m.unit ?? null,
      })),
    };
  }

  return {
    rows: (data ?? []).map((m: any) => ({
      id: m.id,
      title: m.title,
      unit: m.unit ?? null,
    })),
  };
}

/**
 * ✅ Server Action: NO-OP approve (approve tylko na /summary)
 */
export async function noopInventoryApprove() {
  await assertInventoryAccess();
  return { ok: true };
}
