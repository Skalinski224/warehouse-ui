import "server-only";
import { supabaseServer } from "@/lib/supabaseServer";

export type PlaceOption = { id: string; label: string };

export async function fetchPlaceOptions(): Promise<PlaceOption[]> {
  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from("project_places")
    .select("id, label")
    .order("label", { ascending: true });

  if (error) {
    console.error("fetchPlaceOptions error:", error);
    return [];
  }

  return (data ?? []).map((p: any) => ({ id: p.id, label: p.label }));
}
