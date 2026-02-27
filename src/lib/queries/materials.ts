// src/lib/queries/materials.ts
import { supabaseServer } from "@/lib/supabaseServer";
import type { MaterialOverview, MaterialOption } from "@/lib/dto";
import { PERM, can } from "@/lib/permissions";

type SortKey = "title" | "current_quantity" | "base_quantity" | "created_at";
type Dir = "asc" | "desc";
type State = "active" | "deleted";

function calcStockPct(current: any, base: any): number {
  const c = Number(current ?? 0);
  const b = Number(base ?? 0);
  if (!Number.isFinite(c) || !Number.isFinite(b) || b <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((c / b) * 100)));
}

async function getSnapshot() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("my_permissions_snapshot");
  if (error) return null;
  return Array.isArray(data) ? (data[0] ?? null) : (data ?? null);
}

function looksLikeMissingColumn(err: any): boolean {
  const code = String(err?.code || "");
  const msg = String(err?.message || "");
  return (
    code === "42703" ||
    /column .* does not exist/i.test(msg) ||
    /schema cache/i.test(msg) ||
    /could not find/i.test(msg)
  );
}

/* ----------------------------------------------------------------------------
 * 1) Lista materiałów (katalog)
 * ----------------------------------------------------------------------------
 */
export async function fetchMaterials(params: {
  q: string | null;
  sort: SortKey;
  dir: Dir;
  limit: number;
  offset: number;

  // ✅ filtry
  inventory_location_id?: string | null;
  state?: State; // active|deleted
}): Promise<MaterialOverview[]> {
  const snapshot = await getSnapshot();

  if (!can(snapshot, PERM.MATERIALS_READ)) return [];

  const canSeeDeleted = can(snapshot, PERM.MATERIALS_SOFT_DELETE);
  const state: State =
    params.state === "deleted" && canSeeDeleted ? "deleted" : "active";

  const supabase = await supabaseServer();
  const ascending = params.dir !== "desc";

  const selectNew = `
    id,
    title,
    description,
    unit,
    base_quantity,
    current_quantity,
    image_url,
    cta_url,
    created_at,
    inventory_location_id,
    inventory_location_label,
    family_key,
    deleted_at
  `;

  const selectOld = `
    id,
    title,
    description,
    family_key,
    unit,
    base_quantity,
    current_quantity,
    image_url,
    deleted_at,
    created_at
  `;

  async function runSelect(selectStr: string) {
    let query = supabase.from("materials").select(selectStr);

    if (params.q) query = query.ilike("title", `%${params.q}%`);

    if (params.inventory_location_id) {
      query = query.eq("inventory_location_id", params.inventory_location_id);
    }

    // ✅ stan
    if (state === "deleted") query = query.not("deleted_at", "is", null);
    else query = query.is("deleted_at", null);

    query = query.order(params.sort, { ascending });
    query = query.range(params.offset, params.offset + params.limit - 1);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  let data: any[] = [];

  try {
    data = await runSelect(selectNew);
  } catch (e: any) {
    if (!looksLikeMissingColumn(e)) {
      console.error("fetchMaterials error:", e);
      return [];
    }

    // Jak ktoś filtruje po lokacji (kolumna może nie istnieć w starym DB),
    // to nie udawajmy że filtr działa — zwróć pusto.
    if (params.inventory_location_id) return [];

    try {
      data = await runSelect(selectOld);
    } catch (e2: any) {
      console.error("fetchMaterials fallback error:", e2);
      return [];
    }
  }

  return (data ?? []).map((m: any) => ({
    id: m.id,
    title: m.title,
    description: m.description ?? null,
    family_key: m.family_key ?? null,
    unit: m.unit,
    base_quantity: m.base_quantity ?? 0,
    current_quantity: m.current_quantity ?? 0,
    stock_pct: calcStockPct(m.current_quantity, m.base_quantity),
    image_url: m.image_url ?? null,
    deleted_at: m.deleted_at ?? null,
    inventory_location_id: m.inventory_location_id ?? null,
    inventory_location_label: m.inventory_location_label ?? null,
    cta_url: m.cta_url ?? null,
  })) as MaterialOverview[];
}

/* ----------------------------------------------------------------------------
 * 2) Tylko aktywne materiały — do formularzy
 * ----------------------------------------------------------------------------
 */
export async function fetchActiveMaterials(): Promise<MaterialOption[]> {
  const snapshot = await getSnapshot();
  if (!can(snapshot, PERM.MATERIALS_READ)) return [];

  const supabase = await supabaseServer();

  const selectNew = `
    id,
    title,
    unit,
    current_quantity,
    deleted_at,
    inventory_location_id,
    inventory_location_label
  `;

  const selectOld = `
    id,
    title,
    unit,
    current_quantity,
    deleted_at
  `;

  async function run(selectStr: string) {
    const { data, error } = await supabase
      .from("materials")
      .select(selectStr)
      .is("deleted_at", null)
      .order("title");

    if (error) throw error;
    return data ?? [];
  }

  let data: any[] = [];
  try {
    data = await run(selectNew);
  } catch (e: any) {
    if (!looksLikeMissingColumn(e)) {
      console.error("[fetchActiveMaterials] error:", e);
      return [];
    }
    try {
      data = await run(selectOld);
    } catch (e2: any) {
      console.error("[fetchActiveMaterials] fallback error:", e2);
      return [];
    }
  }

  return (
    data?.map((m: any) => ({
      id: m.id,
      title: m.title,
      unit: m.unit,
      currentQuantity: m.current_quantity ?? 0,
    })) ?? []
  );
}
