// src/lib/queries/materials.ts
import { supabaseServer } from "@/lib/supabaseServer";
import type { MaterialOverview } from "@/lib/dto";

type SortKey = "title" | "current_quantity" | "base_quantity" | "created_at";
type Dir = "asc" | "desc";

export async function fetchMaterials(params: {
  q: string | null;
  sort: SortKey;
  dir: Dir;
  include_deleted: boolean;
  limit: number;
  offset: number;
}): Promise<MaterialOverview[]> {
  const supabase = await supabaseServer();

  let query = supabase
    .from("v_materials_overview")
    .select(
      "id, title, unit, base_quantity, current_quantity, image_url, deleted_at",
      { count: "exact" }
    );

  if (params.q) {
    query = query.ilike("title", `%${params.q}%`);
  }

  if (!params.include_deleted) {
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

  return (data ?? []) as MaterialOverview[];
}
