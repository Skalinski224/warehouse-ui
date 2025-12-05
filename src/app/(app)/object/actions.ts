"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabaseServer";

/* -------------------------------------------------------------------------- */
/*                               HELPER: DB                                   */
/* -------------------------------------------------------------------------- */

async function db() {
  return await supabaseServer();
}

function refresh(paths: string[]) {
  for (const p of paths) revalidatePath(p);
}

/* -------------------------------------------------------------------------- */
/*                               CREATE PLACE                                 */
/* -------------------------------------------------------------------------- */
/**
 * Tworzy nowe miejsce (project_places)
 * formData:
 *  - name
 *  - description
 *  - parent_id (opcjonalnie)
 */
export async function createPlace(formData: FormData) {
  const supabase = await db();

  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) {
    console.error("createPlace getUser error:", authError);
    throw new Error("Problem z sesją użytkownika.");
  }
  if (!auth?.user) throw new Error("Brak sesji (user).");

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const parentIdRaw = String(formData.get("parent_id") ?? "").trim();
  const parentId = parentIdRaw ? parentIdRaw : null;

  if (!name) throw new Error("Nazwa miejsca jest wymagana.");

  const { data, error } = await supabase
    .from("project_places")
    .insert({
      name,
      description,
      parent_id: parentId,
      // account_id → default current_account_id()
    })
    .select("id")
    .single();

  if (error) {
    console.error("createPlace error:", error);
    throw new Error("Nie udało się utworzyć miejsca.");
  }

  refresh(["/object"]);
  return (data as { id: string }).id;
}

/* -------------------------------------------------------------------------- */
/*                              CREATE TASK (ZDJĘCIA)                         */
/* -------------------------------------------------------------------------- */
/**
 * Tworzy nowe zadanie, a następnie (opcjonalnie) uploaduje max 3 zdjęcia.
 * Zdjęcia trafiają do bucketa "task-images" w ścieżce:
 *   tasks/<taskId>/<timestamp>-<filename>
 */
export async function createTask(formData: FormData) {
  const supabase = await db();

  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) {
    console.error("createTask getUser error:", authError);
    throw new Error("Problem z sesją użytkownika.");
  }
  if (!auth?.user) throw new Error("Brak sesji (user).");

  const placeId = String(formData.get("place_id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const descriptionRaw = String(formData.get("description") ?? "");
  const description =
    descriptionRaw.trim().length > 0 ? descriptionRaw.trim() : null;

  const assignedCrewIdRaw = String(
    formData.get("assigned_crew_id") ?? ""
  ).trim();
  const assignedCrewId = assignedCrewIdRaw ? assignedCrewIdRaw : null;

  if (!placeId) throw new Error("Brak place_id.");
  if (!title) throw new Error("Tytuł zadania jest wymagany.");

  // 1) tworzymy zadanie BEZ zdjęć (photos ma default '[]')
  const { data: inserted, error } = await supabase
    .from("project_tasks")
    .insert({
      place_id: placeId,
      title,
      description,
      assigned_crew_id: assignedCrewId,
      created_by: auth.user.id,
      status: "todo",
      // account_id → default current_account_id()
      // photos → default []
    })
    .select("id")
    .single();

  if (error) {
    console.error("createTask insert error:", error);
    throw new Error("Nie udało się utworzyć zadania.");
  }

  const taskId = (inserted as { id: string }).id;

  // 2) upload zdjęć (opcjonalnie) do bucketa "task-images"
  const files = formData.getAll("photos") as File[];
  const uploadedUrls: string[] = [];

  if (files && files.length > 0) {
    const maxFiles = 3;
    const filesToUpload = files.slice(0, maxFiles);

    for (const file of filesToUpload) {
      if (!file || typeof file.name !== "string") continue;

      const path = `tasks/${taskId}/${Date.now()}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("task-images")
        .upload(path, file);

      if (uploadError) {
        console.error("createTask upload error:", uploadError);
        continue;
      }

      const { data: urlData } = supabase.storage
        .from("task-images")
        .getPublicUrl(path);

      if (urlData?.publicUrl) {
        uploadedUrls.push(urlData.publicUrl);
      }
    }
  }

  // 3) jeżeli są jakieś zdjęcia – zapisujemy URL-e w kolumnie photos
  if (uploadedUrls.length > 0) {
    const { error: photosError } = await supabase
      .from("project_tasks")
      .update({ photos: uploadedUrls })
      .eq("id", taskId)
      .limit(1);

    if (photosError) {
      console.error("createTask photos update error:", photosError);
      // nie przerywamy – zadanie istnieje, najwyżej bez zdjęć
    }
  }

  refresh([`/object/${placeId}`, "/object", `/tasks/${taskId}`, "/tasks"]);
  return taskId;
}

/* -------------------------------------------------------------------------- */
/*                        OPTIONAL: UPDATE TASK STATUS                         */
/* -------------------------------------------------------------------------- */
export async function updateTaskStatus(taskId: string, status: string) {
  const supabase = await db();

  const { error } = await supabase
    .from("project_tasks")
    .update({ status })
    .eq("id", taskId)
    .limit(1);

  if (error) {
    console.error("updateTaskStatus error:", error);
    throw new Error("Nie udało się zmienić statusu.");
  }
}

/* -------------------------------------------------------------------------- */
/*            UPDATE TASK CREW + SOFT-DELETE POJEDYNCZEGO ZADANIA             */
/* -------------------------------------------------------------------------- */

export async function updateTaskCrew(
  taskId: string,
  assignedCrewId: string | null
) {
  const supabase = await db();

  const { data: existing, error: fetchError } = await supabase
    .from("project_tasks")
    .select("place_id")
    .eq("id", taskId)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchError) {
    console.error("updateTaskCrew fetch error:", fetchError);
    throw new Error("Nie udało się pobrać zadania.");
  }
  if (!existing) {
    return;
  }

  const placeId = (existing as any).place_id as string | null;

  const { error } = await supabase
    .from("project_tasks")
    .update({ assigned_crew_id: assignedCrewId })
    .eq("id", taskId)
    .limit(1);

  if (error) {
    console.error("updateTaskCrew update error:", error);
    throw new Error("Nie udało się zmienić brygady zadania.");
  }

  const paths = ["/tasks"];
  if (placeId) paths.push(`/object/${placeId}`);
  paths.push(`/tasks/${taskId}`);
  refresh(paths);
}

export async function softDeleteTask(taskId: string) {
  const supabase = await db();

  const { data: existing, error: fetchError } = await supabase
    .from("project_tasks")
    .select("place_id")
    .eq("id", taskId)
    .maybeSingle();

  if (fetchError) {
    console.error("softDeleteTask fetch error:", fetchError);
    throw new Error("Nie udało się pobrać zadania.");
  }
  if (!existing) return;

  const placeId = (existing as any).place_id as string | null;
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("project_tasks")
    .update({ deleted_at: now })
    .eq("id", taskId)
    .limit(1);

  if (error) {
    console.error("softDeleteTask update error:", error);
    throw new Error("Nie udało się usunąć zadania.");
  }

  const paths = ["/tasks", `/tasks/${taskId}`];
  if (placeId) paths.push(`/object/${placeId}`);
  refresh(paths);
}

/* -------------------------------------------------------------------------- */
/*              SOFT-DELETE MIEJSCA + JEGO POD-MIEJSC + ZADAŃ                 */
/* -------------------------------------------------------------------------- */

/**
 * Soft delete całego poddrzewa:
 * - zbiera id miejsca i wszystkich jego potomków
 * - ustawia deleted_at dla project_places i project_tasks w tym drzewie
 */
export async function softDeletePlaceDeep(placeId: string) {
  const supabase = await db();

  const visited = new Set<string>();
  const queue: string[] = [placeId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const { data, error } = await supabase
      .from("project_places")
      .select("id")
      .eq("parent_id", current)
      .is("deleted_at", null);

    if (error) {
      console.error("softDeletePlaceDeep children fetch error:", error);
      break;
    }

    const children = (data ?? []) as { id: string }[];
    for (const child of children) {
      if (!visited.has(child.id)) {
        queue.push(child.id);
      }
    }
  }

  const allPlaceIds = Array.from(visited);
  if (allPlaceIds.length === 0) {
    // nic nie znaleziono – ale przynajmniej spróbuj usunąć samo miejsce
    allPlaceIds.push(placeId);
  }

  const now = new Date().toISOString();

  // 1) soft-delete wszystkich zadań w tych miejscach
  const { error: tasksError } = await supabase
    .from("project_tasks")
    .update({ deleted_at: now })
    .in("place_id", allPlaceIds);

  if (tasksError) {
    console.error("softDeletePlaceDeep tasks error:", tasksError);
  }

  // 2) soft-delete wszystkich miejsc
  const { error: placesError } = await supabase
    .from("project_places")
    .update({ deleted_at: now })
    .in("id", allPlaceIds);

  if (placesError) {
    console.error("softDeletePlaceDeep places error:", placesError);
    throw new Error("Nie udało się usunąć miejsca.");
  }

  refresh(["/object"]);
}
