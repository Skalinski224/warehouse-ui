import { supabaseServer } from "@/lib/supabaseServer";
import type {
  DesignerPlanRow,
  DesignerPlanCreateInput,
  DesignerPlanUpdateInput,
  DesignerPlanViewRow,
} from "@/lib/dto/designerPlan";

/**
 * Pobranie listy planów projektanta
 */
export async function fetchDesignerPlans(): Promise<DesignerPlanViewRow[]> {
  const supabase = await supabaseServer();

  // 1) plany
  const { data: plans, error: plansError } = await supabase
    .from("designer_plans")
    .select(`
      id,
      family_key,
      planned_qty,
      created_at
    `)
    .order("created_at", { ascending: false });

  if (plansError) {
    throw new Error(`fetchDesignerPlans: ${plansError.message}`);
  }

  if (!plans?.length) return [];

  // 2) materiały referencyjne po family_key (bierzemy "reprezentanta")
  const familyKeys = Array.from(
    new Set(plans.map((p: any) => p.family_key).filter(Boolean))
  ) as string[];

  const { data: mats, error: matsError } = await supabase
    .from("materials")
    .select("family_key, title, unit")
    .in("family_key", familyKeys);

  if (matsError) {
    throw new Error(`fetchDesignerPlans(materials): ${matsError.message}`);
  }

  // map: family_key -> {title, unit}
  const matByFamily = new Map<string, { title: string | null; unit: string | null }>();
  (mats ?? []).forEach((m: any) => {
    const fk = String(m.family_key);
    // bierzemy pierwszego jako reprezentanta
    if (!matByFamily.has(fk)) {
      matByFamily.set(fk, { title: m.title ?? null, unit: m.unit ?? null });
    }
  });

  return plans.map((row: any) => {
    const fk = String(row.family_key);
    const mat = matByFamily.get(fk);

    return {
      id: row.id,
      family_key: fk,
      planned_qty: row.planned_qty ?? 0,
      material_title: mat?.title ?? "(brak materiału)",
      unit: mat?.unit ?? null,
      updated_at: row.created_at,
    } satisfies DesignerPlanViewRow;
  });
}

/**
 * Dodanie nowej pozycji do planu
 */
export async function createDesignerPlan(
  input: DesignerPlanCreateInput
): Promise<DesignerPlanRow> {
  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from("designer_plans")
    .insert({
      family_key: input.family_key,
      planned_qty: input.planned_qty,
      stage_id: input.stage_id,
      place_id: input.place_id,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`createDesignerPlan: ${error.message}`);
  }

  return data as DesignerPlanRow;
}

/**
 * Inline edit ilości
 */
export async function updateDesignerPlanQty(
  input: DesignerPlanUpdateInput
): Promise<void> {
  const supabase = await supabaseServer();

  const { error } = await supabase
    .from("designer_plans")
    .update({ planned_qty: input.planned_qty })
    .eq("id", input.id);

  if (error) {
    throw new Error(`updateDesignerPlanQty: ${error.message}`);
  }
}

/**
 * Usunięcie planu
 */
export async function deleteDesignerPlan(planId: string): Promise<void> {
  const supabase = await supabaseServer();

  const { error } = await supabase
    .from("designer_plans")
    .delete()
    .eq("id", planId);

  if (error) {
    throw new Error(`deleteDesignerPlan: ${error.message}`);
  }
}
