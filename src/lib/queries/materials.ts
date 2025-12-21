// src/lib/queries/materials.ts

import { supabaseServer } from "@/lib/supabaseServer";
import type { MaterialOverview, MaterialOption } from "@/lib/dto";
import { PERM, can } from "@/lib/permissions";

type SortKey = "title" | "current_quantity" | "base_quantity" | "created_at";
type Dir = "asc" | "desc";

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

/* ----------------------------------------------------------------------------
 * 1) Lista materiałów (katalog)
 *    ŹRÓDŁO: public.materials
 *    - pełny gate permissions
 *    - wyszukiwanie
 *    - sortowanie
 *    - soft-delete
 * ----------------------------------------------------------------------------
 */
export async function fetchMaterials(params: {
  q: string | null;
  sort: SortKey;
  dir: Dir;
  include_deleted: boolean;
  limit: number;
  offset: number;
}): Promise<MaterialOverview[]> {
  const snapshot = await getSnapshot();

  // Gate: czytanie materiałów
  if (!can(snapshot, PERM.MATERIALS_READ)) return [];

  // Bez MATERIALS_SOFT_DELETE nie wolno przeglądać usuniętych,
  // nawet jeśli ktoś spróbuje wcisnąć include_deleted=true z URL.
  const canSeeDeleted = can(snapshot, PERM.MATERIALS_SOFT_DELETE);
  const includeDeleted = params.include_deleted && canSeeDeleted;

  const supabase = await supabaseServer();

  let query = supabase
    .from("materials")
    .select(
      `
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
      `
    );

  if (params.q) {
    query = query.ilike("title", `%${params.q}%`);
  }

  if (!includeDeleted) {
    query = query.is("deleted_at", null);
  }

  const ascending = params.dir !== "desc";
  query = query.order(params.sort, { ascending });

  query = query.range(params.offset, params.offset + params.limit - 1);

  const { data, error } = await query;

  if (error) {
    console.error("fetchMaterials error:", error);
    return [];
  }

  // Składamy MaterialOverview ręcznie (jak dawniej z v_materials_overview)
  return (data ?? []).map((m: any) => ({
    id: m.id,
    title: m.title,
    description: m.description ?? null, // ✅ DODANE
    family_key: m.family_key ?? null,
    unit: m.unit, // zakładamy NOT NULL w DB
    base_quantity: m.base_quantity ?? 0,
    current_quantity: m.current_quantity ?? 0,
    stock_pct: calcStockPct(m.current_quantity, m.base_quantity),
    image_url: m.image_url ?? null,
    deleted_at: m.deleted_at ?? null,
  })) as MaterialOverview[];
}

/* ----------------------------------------------------------------------------
 * 2) Tylko aktywne materiały — do formularzy (dzienne raporty itd.)
 * ----------------------------------------------------------------------------
 */
export async function fetchActiveMaterials(): Promise<MaterialOption[]> {
  const snapshot = await getSnapshot();

  // Gate: bez materials.read nie ma sensu pokazywać materiałów w formularzach
  if (!can(snapshot, PERM.MATERIALS_READ)) return [];

  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from("materials")
    .select("id, title, unit, current_quantity, deleted_at")
    .is("deleted_at", null)
    .order("title");

  if (error) {
    console.error("[fetchActiveMaterials] error:", error);
    return [];
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
