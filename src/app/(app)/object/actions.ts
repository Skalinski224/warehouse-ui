// src/app/(app)/object/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabaseServer";
import type { PermissionSnapshot } from "@/lib/permissions";

/* -------------------------------------------------------------------------- */
/*                               HELPER: DB                                   */
/* -------------------------------------------------------------------------- */

async function db() {
  return await supabaseServer();
}

function refresh(paths: string[]) {
  for (const p of paths) revalidatePath(p);
}

function logRpcError(tag: string, error: any) {
  console.error(tag, {
    code: error?.code,
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
  });
}

/**
 * ✅ Object access gate (server truth).
 * Worker + storeman: zero dostępu do modułu Obiekt (view + akcje).
 * Foreman + manager + owner: pełny dostęp.
 */
async function assertObjectAccess() {
  const supabase = await db();
  const { data, error } = await supabase.rpc("my_permissions_snapshot");
  const snap = (data as PermissionSnapshot | null) ?? null;

  if (error || !snap) throw new Error("Brak uprawnień");
  if (snap.role === "worker" || snap.role === "storeman")
    throw new Error("Brak uprawnień");

  return supabase;
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
  const supabase = await assertObjectAccess();

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
  if (parentId) refresh([`/object/${parentId}`]);

  return (data as { id: string }).id;
}

/* -------------------------------------------------------------------------- */
/*                              CREATE TASK (ZDJĘCIA)                         */
/* -------------------------------------------------------------------------- */

function isImageFile(x: unknown): x is File {
  return (
    typeof x === "object" &&
    x instanceof File &&
    x.size > 0 &&
    (x.type ?? "").startsWith("image/")
  );
}

function extFromFile(file: File): string {
  const name = (file.name ?? "").trim();
  const dot = name.lastIndexOf(".");
  if (dot > -1 && dot < name.length - 1) {
    const ext = name.slice(dot + 1).toLowerCase();
    if (ext && ext.length <= 8) return ext;
  }

  const t = (file.type ?? "").toLowerCase();
  if (t === "image/jpeg") return "jpg";
  if (t === "image/png") return "png";
  if (t === "image/webp") return "webp";
  if (t === "image/gif") return "gif";

  return "bin";
}

/**
 * Tworzy nowe zadanie, a następnie (opcjonalnie) uploaduje max 3 zdjęcia.
 * ZDJĘCIA: zapis do storage + rekordy w task_attachments (url = storage path)
 *
 * Format:
 *   <account_id>/tasks/<taskId>/<timestamp>-<uuid>.<ext>
 */
export async function createTask(formData: FormData) {
  const supabase = await assertObjectAccess();

  // auth
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

  const assignedCrewIdRaw = String(formData.get("assigned_crew_id") ?? "").trim();
  const assignedCrewId = assignedCrewIdRaw ? assignedCrewIdRaw : null;

  const assignedMemberIdRaw = String(
    formData.get("assigned_member_id") ?? ""
  ).trim();
  const assignedMemberId = assignedMemberIdRaw ? assignedMemberIdRaw : null;

  if (!placeId) throw new Error("Brak place_id.");
  if (!title) throw new Error("Tytuł zadania jest wymagany.");

  // account_id (potrzebne do ścieżki uploadu)
  const { data: me, error: meError } = await supabase
    .from("users")
    .select("account_id")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (meError) {
    console.error("createTask users(account_id) error:", meError);
    throw new Error("Nie udało się pobrać account_id.");
  }

  const accountId = (me as any)?.account_id as string | null;
  if (!accountId) throw new Error("Brak account_id dla usera.");

  // 1) tworzymy zadanie (BEZ zdjęć w kolumnie photos)
  const { data: inserted, error } = await supabase
    .from("project_tasks")
    .insert({
      place_id: placeId,
      title,
      description,
      assigned_crew_id: assignedCrewId,
      assigned_member_id: assignedMemberId,
      created_by: auth.user.id,
      status: "todo",
      // account_id → default current_account_id()
      // photos → default [] (nie używamy do wyświetlania)
    })
    .select("id")
    .single();

  if (error) {
    console.error("createTask insert error:", error);
    throw new Error("Nie udało się utworzyć zadania.");
  }

  const taskId = (inserted as { id: string }).id;

  // 2) upload zdjęć (opcjonalnie) + insert do task_attachments
  const all = formData.getAll("photos");
  const files = all.filter(isImageFile).slice(0, 3);

  for (const file of files) {
    const ext = extFromFile(file);
    const filename = `${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const path = `${accountId}/tasks/${taskId}/${filename}`;

    const { error: uploadError } = await supabase.storage
      .from("task-images")
      .upload(path, file, {
        upsert: false,
        contentType: file.type || undefined,
        cacheControl: "3600",
      });

    if (uploadError) {
      console.error("createTask upload error:", uploadError);
      throw new Error("Nie udało się wgrać zdjęcia do Storage.");
    }

    const { error: attError } = await supabase.from("task_attachments").insert({
      task_id: taskId,
      url: path, // PATH (nie publicUrl)
      created_by: auth.user.id,
      // account_id → jeśli masz default current_account_id() to nie podawaj;
      // jeśli NIE masz defaultu i kolumna jest required, odkomentuj:
      // account_id: accountId,
    });

    if (attError) {
      console.error("createTask task_attachments insert error:", attError);
      throw new Error("Nie udało się zapisać zdjęcia w bazie (task_attachments).");
    }
  }

  refresh([`/object/${placeId}`, "/object", `/tasks/${taskId}`, "/tasks"]);
  return taskId;
}

/* -------------------------------------------------------------------------- */
/*                        OPTIONAL: UPDATE TASK STATUS                         */
/* -------------------------------------------------------------------------- */
export async function updateTaskStatus(taskId: string, status: string) {
  const supabase = await assertObjectAccess();

  const { error } = await supabase
    .from("project_tasks")
    .update({ status })
    .eq("id", taskId)
    .limit(1);

  if (error) {
    console.error("updateTaskStatus error:", error);
    throw new Error("Nie udało się zmienić statusu.");
  }

  refresh(["/tasks", `/tasks/${taskId}`]);
}

/* -------------------------------------------------------------------------- */
/*            UPDATE TASK CREW + SOFT-DELETE POJEDYNCZEGO ZADANIA             */
/* -------------------------------------------------------------------------- */

export async function updateTaskCrew(
  taskId: string,
  assignedCrewId: string | null
) {
  const supabase = await assertObjectAccess();

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
  if (!existing) return;

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
  const supabase = await assertObjectAccess();

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
  const supabase = await assertObjectAccess();

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
      if (!visited.has(child.id)) queue.push(child.id);
    }
  }

  const allPlaceIds = Array.from(visited);
  if (allPlaceIds.length === 0) allPlaceIds.push(placeId);

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
