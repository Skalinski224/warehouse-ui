// src/lib/queries/projectplaces.ts
import "server-only";
import { supabaseServer } from "@/lib/supabaseServer";

export type PlaceOption = { id: string; label: string };

function looksLikeMissingColumn(err: any, col: string): boolean {
  const msg = String(err?.message || "").toLowerCase();
  // typowe komunikaty Postgresa/Supabase
  return msg.includes(`column`) && msg.includes(`"${col.toLowerCase()}"`) && msg.includes("does not exist");
}

export async function fetchPlaceOptions(): Promise<PlaceOption[]> {
  const supabase = await supabaseServer();

  // 1) Najpierw próbujemy aktualny kontrakt tego pliku: label
  const q1 = await supabase.from("project_places").select("id, label").order("label", {
    ascending: true,
  });

  if (!q1.error) {
    return (q1.data ?? []).map((p: any) => ({ id: p.id, label: p.label }));
  }

  // 2) Jeśli baza ma inne pole (np. name), robimy fallback bez wywracania całej appki
  if (looksLikeMissingColumn(q1.error, "label")) {
    const q2 = await supabase.from("project_places").select("id, name").order("name", {
      ascending: true,
    });

    if (q2.error) {
      console.error("fetchPlaceOptions error (fallback name):", q2.error);
      return [];
    }

    return (q2.data ?? []).map((p: any) => ({ id: p.id, label: p.name }));
  }

  console.error("fetchPlaceOptions error:", q1.error);
  return [];
}