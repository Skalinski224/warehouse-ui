// src/app/(app)/tasks/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabaseServer";
import { PERM, can, type PermissionSnapshot } from "@/lib/permissions";

async function db() {
  return await supabaseServer();
}

type TaskStatus = "todo" | "in_progress" | "done";

const TASK_BUCKET = "task-images";
const MAX_TASK_PHOTOS = 3;

/* -------------------------------------------------------------------------- */
/*                           STORAGE (SERVICE ROLE)                           */
/* -------------------------------------------------------------------------- */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function storageAdmin() {
  if (!url || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

/* -------------------------------------------------------------------------- */
/*                         PERMISSIONS (SERVER GATE)                          */
/* -------------------------------------------------------------------------- */

async function fetchMyPermissionsSnapshot(
  supabase: Awaited<ReturnType<typeof db>>
): Promise<PermissionSnapshot | null> {
  const { data, error } = await supabase.rpc("my_permissions_snapshot");
  if (error) {
    console.error("my_permissions_snapshot error:", error);
    return null;
  }
  const snap = Array.isArray(data) ? (data[0] ?? null) : (data ?? null);
  return (snap as PermissionSnapshot | null) ?? null;
}

function deny(msg = "Brak uprawnień."): never {
  throw new Error(msg);
}

function requirePerm(
  snapshot: PermissionSnapshot | null,
  p: (typeof PERM)[keyof typeof PERM],
  msg?: string
) {
  if (!can(snapshot, p)) deny(msg ?? "Brak uprawnień.");
}

function requireAny(
  snapshot: PermissionSnapshot | null,
  perms: ((typeof PERM)[keyof typeof PERM])[],
  msg?: string
) {
  const ok = perms.some((p) => can(snapshot, p as any));
  if (!ok) deny(msg ?? "Brak uprawnień.");
}

/* -------------------------------------------------------------------------- */
/*                                 HELPERS                                    */
/* -------------------------------------------------------------------------- */

function cleanStr(v: unknown): string {
  return String(v ?? "").trim();
}

function isImageFile(x: unknown): x is File {
  return (
    typeof x === "object" &&
    x instanceof File &&
    x.size > 0 &&
    (x.type ?? "").startsWith("image/")
  );
}

function formFileList(formData: FormData, key: string): File[] {
  const raw = formData.getAll(key);
  const files = raw.filter(isImageFile);
  return files.filter((f) => typeof f.name === "string" && f.name.length > 0);
}

async function getCurrentUserId(supabase: Awaited<ReturnType<typeof db>>) {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    console.error("auth.getUser error:", error);
    throw new Error("Problem z sesją użytkownika.");
  }
  const userId = data?.user?.id ?? null;
  if (!userId) throw new Error("Brak sesji użytkownika.");
  return userId;
}

async function getMyAccountId(
  supabase: Awaited<ReturnType<typeof db>>,
  userId: string
) {
  // Kanon: user.id == auth.user.id; tabela users trzyma account_id
  const { data, error } = await supabase
    .from("users")
    .select("account_id")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("getMyAccountId error:", error);
    throw new Error("Nie udało się pobrać account_id.");
  }

  const accountId = (data as any)?.account_id as string | null;
  if (!accountId) throw new Error("Brak account_id.");
  return accountId;
}

async function getTaskPlaceId(
  supabase: Awaited<ReturnType<typeof db>>,
  taskId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("project_tasks")
    .select("place_id")
    .eq("id", taskId)
    .maybeSingle();

  if (error) {
    console.error("getTaskPlaceId error:", error);
    return null;
  }
  return (data as any)?.place_id ?? null;
}

async function countExistingAttachments(
  supabase: Awaited<ReturnType<typeof db>>,
  taskId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("task_attachments")
    .select("id", { count: "exact", head: true })
    .eq("task_id", taskId);

  if (error) {
    console.error("countExistingAttachments error:", error);
    return 0;
  }

  return typeof count === "number" ? count : 0;
}

async function refreshTaskPhotosCompat(
  supabase: Awaited<ReturnType<typeof db>>,
  taskId: string
) {
  const { data, error } = await supabase
    .from("task_attachments")
    .select("url")
    .eq("task_id", taskId);

  if (error) {
    console.error("refreshTaskPhotosCompat read attachments error:", error);
    return;
  }

  const paths = (data ?? [])
    .map((r: any) => String(r.url ?? "").trim())
    .filter(Boolean);

  const publicUrls = paths
    .map((path) => {
      const { data: urlData } = supabase.storage.from(TASK_BUCKET).getPublicUrl(path);
      return urlData?.publicUrl ?? null;
    })
    .filter(Boolean) as string[];

  const { error: upErr } = await supabase
    .from("project_tasks")
    .update({ photos: publicUrls })
    .eq("id", taskId)
    .limit(1);

  if (upErr) {
    console.error("refreshTaskPhotosCompat update project_tasks.photos error:", upErr);
  }
}

/**
 * Upload do Storage robimy SERVICE ROLE (żeby nie wywalało na RLS storage.objects),
 * ale zapis do task_attachments i update project_tasks zostają na supabaseServer()
 * (czyli dalej trzymasz multi-tenant i permsy po stronie DB).
 *
 * KLUCZ: ścieżka pliku MUSI być taka sama jak w module Obiekt:
 *   <accountId>/tasks/<taskId>/...
 */
async function uploadAndAttachPhotos(
  supabase: Awaited<ReturnType<typeof db>>,
  taskId: string,
  files: File[],
  accountId: string
) {
  if (!files || files.length === 0) return;

  const existingCount = await countExistingAttachments(supabase, taskId);
  if (existingCount >= MAX_TASK_PHOTOS) return;

  const remaining = Math.max(0, MAX_TASK_PHOTOS - existingCount);
  const toUpload = files.slice(0, remaining);

  const admin = storageAdmin();

  for (const file of toUpload) {
    const safeName = String(file.name || "file").replace(/[^\w.\-]+/g, "_");
    const path = `${accountId}/tasks/${taskId}/${Date.now()}-${safeName}`;

    const { error: upErr } = await admin.storage.from(TASK_BUCKET).upload(path, file, {
      upsert: false,
      contentType: (file as any)?.type || undefined,
      cacheControl: "3600",
    });

    if (upErr) {
      console.error("uploadAndAttachPhotos upload error:", upErr);
      continue;
    }

    const { error: insErr } = await supabase
      .from("task_attachments")
      .insert({ task_id: taskId, url: path });

    if (insErr) {
      console.error("uploadAndAttachPhotos insert attachment error:", insErr);
      await admin.storage.from(TASK_BUCKET).remove([path]).catch(() => {});
      continue;
    }
  }

  await refreshTaskPhotosCompat(supabase, taskId);
}

/* -------------------------------------------------------------------------- */
/*                         CREATE TASK – /tasks (global)                       */
/* -------------------------------------------------------------------------- */

/**
 * Tylko foreman/manager/owner (czyli ci, którzy mają permsy manage/assign).
 */
export async function createTaskGlobal(formData: FormData) {
  const supabase = await db();
  const snapshot = await fetchMyPermissionsSnapshot(supabase);

  requireAny(
    snapshot,
    [PERM.TASKS_UPDATE_ALL, PERM.TASKS_ASSIGN],
    "Brak uprawnień do tworzenia zadań."
  );

  const files = formFileList(formData, "photos");
  if (files.length) {
    requirePerm(snapshot, PERM.TASKS_UPLOAD_PHOTOS, "Brak uprawnień do uploadu zdjęć.");
  }

  const userId = await getCurrentUserId(supabase);
  const accountId = await getMyAccountId(supabase, userId);

  const title = cleanStr(formData.get("title"));
  const descriptionRaw = String(formData.get("description") ?? "");
  const description = descriptionRaw.trim().length ? descriptionRaw.trim() : null;

  const placeId = cleanStr(formData.get("place_id"));
  const assignedCrewIdRaw = cleanStr(formData.get("assigned_crew_id"));
  const assignedMemberIdRaw = cleanStr(formData.get("assigned_member_id"));

  if (!title) throw new Error("Tytuł zadania jest wymagany.");
  if (!placeId) throw new Error("Miejsce jest wymagane.");

  const payload: Record<string, unknown> = {
    place_id: placeId,
    title,
    description,
    status: "todo",
    created_by: userId,
  };

  const assigned_crew_id = assignedCrewIdRaw || null;
  const assigned_member_id = assignedMemberIdRaw || null;

  if (assigned_member_id) {
    payload.assigned_member_id = assigned_member_id;
    if (assigned_crew_id) payload.assigned_crew_id = assigned_crew_id;
  } else if (assigned_crew_id) {
    payload.assigned_crew_id = assigned_crew_id;
  }

  const { data, error } = await supabase
    .from("project_tasks")
    .insert(payload)
    .select("id, place_id")
    .single();

  if (error) {
    console.error("createTaskGlobal insert error:", error);
    throw new Error("Nie udało się utworzyć zadania.");
  }

  const taskId = String((data as any).id);
  const pId = String((data as any).place_id ?? placeId);

  if (files.length) {
    await uploadAndAttachPhotos(supabase, taskId, files, accountId);
  }

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
  if (pId) revalidatePath(`/object/${pId}`);

  return taskId;
}

/* -------------------------------------------------------------------------- */
/*                      CREATE TASK – /object (place locked)                   */
/* -------------------------------------------------------------------------- */

export async function createTaskForPlace(formData: FormData) {
  return await createTaskGlobal(formData);
}

/* -------------------------------------------------------------------------- */
/*                         UPDATE TASK – panel menedżera                       */
/* -------------------------------------------------------------------------- */

export async function updateTaskManager(formData: FormData) {
  const supabase = await db();
  const snapshot = await fetchMyPermissionsSnapshot(supabase);

  requireAny(
    snapshot,
    [PERM.TASKS_UPDATE_ALL, PERM.TASKS_ASSIGN],
    "Brak uprawnień do edycji zadań."
  );

  const taskId = cleanStr(formData.get("task_id"));
  if (!taskId) throw new Error("Brak task_id.");

  const userId = await getCurrentUserId(supabase);
  const accountId = await getMyAccountId(supabase, userId);

  const titleRaw = cleanStr(formData.get("title"));
  const descriptionRaw = String(formData.get("description") ?? "");
  const description = descriptionRaw.trim().length ? descriptionRaw.trim() : null;

  const statusRaw = cleanStr(formData.get("status"));
  const status: TaskStatus = (statusRaw as TaskStatus) || "todo";

  const assignedCrewIdRaw = cleanStr(formData.get("assigned_crew_id"));
  const assignedMemberIdRaw = cleanStr(formData.get("assigned_member_id"));

  const assigned_crew_id = assignedCrewIdRaw || null;
  const assigned_member_id = assignedMemberIdRaw || null;

  const updatePayload: Record<string, unknown> = { status };
  if (titleRaw) updatePayload.title = titleRaw;
  updatePayload.description = description;

  if (assigned_member_id) {
    updatePayload.assigned_member_id = assigned_member_id;
    updatePayload.assigned_crew_id = assigned_crew_id;
  } else {
    updatePayload.assigned_member_id = null;
    updatePayload.assigned_crew_id = assigned_crew_id;
  }

  const { data: row, error } = await supabase
    .from("project_tasks")
    .update(updatePayload)
    .eq("id", taskId)
    .select("id, place_id")
    .maybeSingle();

  if (error) {
    console.error("updateTaskManager update error:", error);
    throw new Error("Nie udało się zapisać zmian.");
  }

  const placeId: string | null =
    (row as any)?.place_id ?? (await getTaskPlaceId(supabase, taskId));

  const files = formFileList(formData, "photos");
  if (files.length) {
    requirePerm(snapshot, PERM.TASKS_UPLOAD_PHOTOS, "Brak uprawnień do uploadu zdjęć.");
    await uploadAndAttachPhotos(supabase, taskId, files, accountId);
  }

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
  if (placeId) revalidatePath(`/object/${placeId}`);

  return taskId;
}

/* -------------------------------------------------------------------------- */
/*                         UPLOAD PHOTOS – dla uploaderów                      */
/* -------------------------------------------------------------------------- */

export async function uploadTaskPhotos(formData: FormData) {
  const supabase = await db();
  const snapshot = await fetchMyPermissionsSnapshot(supabase);

  requirePerm(snapshot, PERM.TASKS_UPLOAD_PHOTOS, "Brak uprawnień do uploadu zdjęć.");

  const taskId = String(formData.get("task_id") ?? "").trim();
  if (!taskId) throw new Error("Brak task_id.");

  const files = formFileList(formData, "photos");
  if (!files || files.length === 0) return;

  const already = await countExistingAttachments(supabase, taskId);
  const remaining = Math.max(0, MAX_TASK_PHOTOS - already);
  if (remaining <= 0) return;

  const toUpload = files.slice(0, remaining);

  const userId = await getCurrentUserId(supabase);
  const accountId = await getMyAccountId(supabase, userId);

  const admin = storageAdmin();
  const rowsToInsert: { task_id: string; url: string }[] = [];

  for (const file of toUpload) {
    const safeName = String(file.name || "file").replace(/[^\w.\-]+/g, "_");
    const path = `${accountId}/tasks/${taskId}/${Date.now()}-${safeName}`;

    const { error: uploadErr } = await admin.storage.from(TASK_BUCKET).upload(path, file, {
      upsert: false,
      contentType: (file as any)?.type || undefined,
      cacheControl: "3600",
    });

    if (uploadErr) {
      console.error("uploadTaskPhotos storage upload error:", uploadErr);
      continue;
    }

    rowsToInsert.push({ task_id: taskId, url: path });
  }

  if (rowsToInsert.length === 0) return;

  const { error: insErr } = await supabase.from("task_attachments").insert(rowsToInsert);
  if (insErr) {
    console.error("uploadTaskPhotos insert task_attachments error:", insErr);
    await admin
      .storage
      .from(TASK_BUCKET)
      .remove(rowsToInsert.map((r) => r.url))
      .catch(() => {});
    throw new Error("Nie udało się zapisać zdjęć w bazie.");
  }

  await refreshTaskPhotosCompat(supabase, taskId);

  const placeId = await getTaskPlaceId(supabase, taskId);

  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/tasks");
  if (placeId) revalidatePath(`/object/${placeId}`);
}

/* -------------------------------------------------------------------------- */
/*                         DELETE PHOTO – ze strony taska                      */
/* -------------------------------------------------------------------------- */

export async function deleteTaskPhoto(formData: FormData) {
  const supabase = await db();
  const snapshot = await fetchMyPermissionsSnapshot(supabase);

  requirePerm(snapshot, PERM.TASKS_UPDATE_ALL, "Brak uprawnień do usuwania zdjęć.");

  const taskId = cleanStr(formData.get("task_id"));
  if (!taskId) throw new Error("Brak task_id.");

  const photoId = cleanStr(formData.get("photo_id"));
  const photoPath = cleanStr(formData.get("photo_path")) || cleanStr(formData.get("photo_url"));

  let pathToRemove: string | null = null;

  if (photoId) {
    const { data, error } = await supabase
      .from("task_attachments")
      .select("url")
      .eq("id", photoId)
      .eq("task_id", taskId)
      .maybeSingle();

    if (error) console.error("deleteTaskPhoto read attachment by id error:", error);
    pathToRemove = (data as any)?.url ? String((data as any).url) : null;

    const { error: delErr } = await supabase
      .from("task_attachments")
      .delete()
      .eq("id", photoId)
      .eq("task_id", taskId);

    if (delErr) console.error("deleteTaskPhoto delete attachment by id error:", delErr);
  } else if (photoPath) {
    pathToRemove = photoPath;

    const { error: delErr } = await supabase
      .from("task_attachments")
      .delete()
      .eq("task_id", taskId)
      .eq("url", photoPath);

    if (delErr) console.error("deleteTaskPhoto delete attachment by path error:", delErr);
  } else {
    return;
  }

  if (pathToRemove) {
    const admin = storageAdmin();
    const { error: rmErr } = await admin.storage.from(TASK_BUCKET).remove([pathToRemove]);
    if (rmErr) console.error("deleteTaskPhoto storage remove error:", rmErr);
  }

  await refreshTaskPhotosCompat(supabase, taskId);

  const placeId = await getTaskPlaceId(supabase, taskId);

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
  if (placeId) revalidatePath(`/object/${placeId}`);
}

/* -------------------------------------------------------------------------- */
/*                         SOFT DELETE TASK                                    */
/* -------------------------------------------------------------------------- */

export async function softDeleteTask(formData: FormData) {
  const supabase = await db();
  const snapshot = await fetchMyPermissionsSnapshot(supabase);

  requirePerm(snapshot, PERM.TASKS_UPDATE_ALL, "Brak uprawnień do usuwania zadań.");

  const taskId = cleanStr(formData.get("task_id"));
  if (!taskId) throw new Error("Brak task_id.");

  const placeId = await getTaskPlaceId(supabase, taskId);

  const { error } = await supabase
    .from("project_tasks")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", taskId);

  if (error) {
    console.error("softDeleteTask error:", error);
    throw new Error("Nie udało się usunąć zadania.");
  }

  revalidatePath("/tasks");
  if (placeId) revalidatePath(`/object/${placeId}`);
}
