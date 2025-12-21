// src/lib/queries/stageReports.ts
import { supabaseServer } from "@/lib/supabaseServer";
import { PERM, can } from "@/lib/permissions";

export type StageTaskRow = {
  id: string;
  title: string;
  status: string;
  placeId: string | null;
  rootPlaceId: string | null; // główne miejsce (np. "Rozdzielnia A")
  rootPlaceName: string; // nagłówek H2
  subPlaceName: string | null; // doprecyzowane miejsce (np. "ściana południowa")
};

async function canReadStageReports(): Promise<boolean> {
  const supabase = await supabaseServer();

  const { data, error } = await supabase.rpc("my_permissions_snapshot");
  if (error) return false;

  const snapshot = Array.isArray(data) ? data[0] : data;
  if (!snapshot) return false;

  return can(snapshot, PERM.REPORTS_STAGES_READ);
}

export async function fetchTasksForStageReport(): Promise<StageTaskRow[]> {
  // Permission gate: raport etapu
  const allowed = await canReadStageReports();
  if (!allowed) return [];

  const supabase = await supabaseServer();

  // 1) Wszystkie zadania (w tym zakończone) – bo raport etapu ma pokazywać całość
  const { data: taskRows, error: tasksError } = await supabase
    .from("project_tasks")
    .select("id, title, status, place_id")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (tasksError) {
    console.error("[fetchTasksForStageReport] tasks error:", tasksError);
    return [];
  }

  const tasks = (taskRows ?? []) as any[];

  if (tasks.length === 0) return [];

  // 2) Miejsca, do których przypisane są zadania
  const placeIds = Array.from(
    new Set(
      tasks
        .map((t) => t.place_id as string | null)
        .filter((id): id is string => !!id)
    )
  );

  const { data: placesRows, error: placesError } = await supabase
    .from("project_places")
    .select("id, name, parent_id")
    .in("id", placeIds);

  if (placesError) {
    console.error("[fetchTasksForStageReport] places error:", placesError);
    return [];
  }

  const places = (placesRows ?? []) as any[];

  const parentIds = Array.from(
    new Set(
      places
        .map((p) => p.parent_id as string | null)
        .filter((id): id is string => !!id)
    )
  );

  // 3) Rodzice miejsc (główne miejsca – nagłówki H2)
  let parents: any[] = [];
  if (parentIds.length > 0) {
    const { data: parentRows, error: parentError } = await supabase
      .from("project_places")
      .select("id, name")
      .in("id", parentIds);

    if (parentError) {
      console.error("[fetchTasksForStageReport] parent places error:", parentError);
    } else {
      parents = parentRows ?? [];
    }
  }

  const placeMap = new Map<string, any>();
  places.forEach((p) => placeMap.set(String(p.id), p));

  const parentMap = new Map<string, any>();
  parents.forEach((p) => parentMap.set(String(p.id), p));

  // 4) Zmapowane wiersze
  const result: StageTaskRow[] = tasks.map((t) => {
    const placeId = (t.place_id as string | null) ?? null;
    const place = placeId ? placeMap.get(placeId) : null;

    let rootPlaceId: string | null = null;
    let rootPlaceName = "Bez miejsca";
    let subPlaceName: string | null = null;

    if (place) {
      const parentId = (place.parent_id as string | null) ?? null;
      if (parentId && parentMap.has(parentId)) {
        const parent = parentMap.get(parentId);
        rootPlaceId = String(parent.id);
        rootPlaceName = String(parent.name ?? "Miejsce");
        subPlaceName = String(place.name ?? "");
      } else {
        // brak rodzica → to miejsce jest głównym
        rootPlaceId = String(place.id);
        rootPlaceName = String(place.name ?? "Miejsce");
        subPlaceName = null;
      }
    }

    return {
      id: String(t.id),
      title: String(t.title ?? ""),
      status: String(t.status ?? ""),
      placeId,
      rootPlaceId,
      rootPlaceName,
      subPlaceName,
    };
  });

  return result;
}
