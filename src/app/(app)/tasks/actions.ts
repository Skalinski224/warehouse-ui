"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";

async function db() {
  return await supabaseServer();
}

type TaskStatus = "todo" | "in_progress" | "done";

/* -------------------------------------------------------------------------- */
/*                  CREATE TASK z widoku „Moje zadania”                       */
/* -------------------------------------------------------------------------- */
/**
 * Tworzenie zadania z zakładki /tasks:
 * - Miejsce (place_id) jest wymagane.
 * - Można przypisać:
 *    • tylko brygadę (assigned_crew_id),
 *    • tylko osobę (assigned_member_id),
 *    • brygadę + osobę (osoba ważniejsza przy logice pracownika).
 * - Zadanie startuje ze statusem "todo".
 * - Można dodać max 3 zdjęcia (bucket: task-images).
 */
export async function createTaskGlobal(formData: FormData) {
  const supabase = await db();

  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) {
    console.error("createTaskGlobal getUser error:", authError);
    throw new Error("Problem z sesją użytkownika.");
  }
  if (!auth?.user) {
    throw new Error("Brak sesji użytkownika.");
  }

  const title = String(formData.get("title") ?? "").trim();
  const descriptionRaw = String(formData.get("description") ?? "");
  const description =
    descriptionRaw.trim().length > 0 ? descriptionRaw.trim() : null;

  const placeId = String(formData.get("place_id") ?? "").trim();

  const assignedCrewIdRaw = String(
    formData.get("assigned_crew_id") ?? ""
  ).trim();
  const assignedMemberIdRaw = String(
    formData.get("assigned_member_id") ?? ""
  ).trim();

  if (!title) {
    throw new Error("Tytuł zadania jest wymagany.");
  }
  if (!placeId) {
    throw new Error("Miejsce jest wymagane.");
  }

  const assigned_crew_id = assignedCrewIdRaw || null;
  const assigned_member_id = assignedMemberIdRaw || null;

  // Payload podstawowy
  const payload: Record<string, unknown> = {
    place_id: placeId,
    title,
    description,
    status: "todo",
    created_by: auth.user.id,
  };

  // Jeśli wybrano osobę – ona jest najważniejsza
  if (assigned_member_id) {
    payload.assigned_member_id = assigned_member_id;
    if (assigned_crew_id) {
      payload.assigned_crew_id = assigned_crew_id;
    }
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

  const taskId = data.id as string;
  const pId = (data.place_id as string) ?? placeId;

  // --- UPLOAD ZDJĘĆ (opcjonalnie, max 3) ---
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
        console.error("createTaskGlobal upload error:", uploadError);
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

  if (uploadedUrls.length > 0) {
    const { error: photosError } = await supabase
      .from("project_tasks")
      .update({ photos: uploadedUrls })
      .eq("id", taskId)
      .limit(1);

    if (photosError) {
      console.error("createTaskGlobal photos update error:", photosError);
      // zadanie istnieje – nie przerywamy całej akcji
    }
  }

  // Odśwież widoki listy i szczegółu
  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
  if (pId) {
    revalidatePath(`/object/${pId}`);
  }

  // Bez redirectu – zostajemy na /tasks, lista sama się odświeży
  return taskId;
}

/**
 * Update zadania z panelu menedżera:
 * - tytuł
 * - opis
 * - status
 * - przypisana brygada
 * - przypisana osoba
 * - zdjęcia (max 3, dopisywane do istniejących)
 *
 * Zdjęcia są trzymane w bucketcie "task-images" pod ścieżką:
 *   tasks/<taskId>/<timestamp>-<filename>
 */
export async function updateTaskManager(formData: FormData) {
  const taskId = String(formData.get("task_id") ?? "").trim();
  if (!taskId) throw new Error("Brak task_id.");

  const statusRaw = String(formData.get("status") ?? "").trim();
  const status: TaskStatus = (statusRaw as TaskStatus) || "todo";

  const assignedCrewIdRaw = String(
    formData.get("assigned_crew_id") ?? ""
  ).trim();
  const assignedCrewId = assignedCrewIdRaw || null;

  const assignedMemberIdRaw = String(
    formData.get("assigned_member_id") ?? ""
  ).trim();
  const assignedMemberId = assignedMemberIdRaw || null;

  const titleRaw = String(formData.get("title") ?? "").trim();
  const descriptionRaw = String(formData.get("description") ?? "");

  // pliki zdjęć (mogą nie być wysłane)
  const files = formData.getAll("photos") as File[];

  const supabase = await db();

  // 1) wczytujemy obecne zdjęcia + place_id
  const { data: existingRow, error: existingError } = await supabase
    .from("project_tasks")
    .select("photos, place_id")
    .eq("id", taskId)
    .maybeSingle();

  if (existingError) {
    console.error("updateTaskManager existingRow error:", existingError);
    throw new Error("Nie udało się pobrać zadania.");
  }
  if (!existingRow) {
    throw new Error("Zadanie nie istnieje.");
  }

  let currentPhotos: string[] = [];
  if (Array.isArray((existingRow as any).photos)) {
    currentPhotos = (existingRow as any).photos.filter(
      (p: unknown): p is string => typeof p === "string"
    );
  }

  const placeId: string | null = (existingRow as any).place_id ?? null;

  // 2) upload nowych zdjęć (max 3) do bucketa "task-images"
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
        console.error("updateTaskManager upload error:", uploadError);
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

  const mergedPhotos = [...currentPhotos, ...uploadedUrls].slice(0, 3);

  // 3) payload do update
  const updatePayload: Record<string, any> = {
    status,
    assigned_crew_id: assignedCrewId,
    assigned_member_id: assignedMemberId,
    photos: mergedPhotos,
  };

  if (titleRaw) {
    updatePayload.title = titleRaw;
  }
  if (descriptionRaw.trim().length > 0) {
    updatePayload.description = descriptionRaw.trim();
  }

  const { error: updateError } = await supabase
    .from("project_tasks")
    .update(updatePayload)
    .eq("id", taskId)
    .limit(1);

  if (updateError) {
    console.error("updateTaskManager update error:", updateError);
    throw new Error("Nie udało się zaktualizować zadania.");
  }

  // 4) odśwież widoki
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/tasks");
  if (placeId) {
    revalidatePath(`/object/${placeId}`);
  }
}

/**
 * Usuwanie pojedynczego zdjęcia:
 * - usuwa plik ze storage "task-images"
 * - wyrzuca URL z tablicy photos w project_tasks
 */
export async function deleteTaskPhoto(formData: FormData) {
  const taskId = String(formData.get("task_id") ?? "").trim();
  const photoUrl = String(formData.get("photo_url") ?? "").trim();

  if (!taskId) throw new Error("Brak task_id.");
  if (!photoUrl) return;

  const supabase = await db();

  // 1) pobierz current photos + place_id
  const { data: existingRow, error: existingError } = await supabase
    .from("project_tasks")
    .select("photos, place_id")
    .eq("id", taskId)
    .maybeSingle();

  if (existingError) {
    console.error("deleteTaskPhoto existingRow error:", existingError);
    throw new Error("Nie udało się pobrać zadania.");
  }
  if (!existingRow) {
    throw new Error("Zadanie nie istnieje.");
  }

  let currentPhotos: string[] = [];
  if (Array.isArray((existingRow as any).photos)) {
    currentPhotos = (existingRow as any).photos.filter(
      (p: unknown): p is string => typeof p === "string"
    );
  }

  const placeId: string | null = (existingRow as any).place_id ?? null;

  // 2) wylicz ścieżkę w buckecie z URL-a
  let storagePath: string | null = null;
  try {
    const url = new URL(photoUrl);
    const marker = "/object/public/task-images/";
    const idx = url.pathname.indexOf(marker);
    if (idx !== -1) {
      storagePath = url.pathname.slice(idx + marker.length);
    } else {
      // fallback: szukamy /task-images/
      const altMarker = "/task-images/";
      const idx2 = url.pathname.indexOf(altMarker);
      if (idx2 !== -1) {
        storagePath = url.pathname.slice(idx2 + altMarker.length);
      }
    }
  } catch (e) {
    console.error("deleteTaskPhoto URL parse error:", e);
  }

  if (storagePath) {
    const { error: removeError } = await supabase.storage
      .from("task-images")
      .remove([storagePath]);

    if (removeError) {
      console.error("deleteTaskPhoto remove error:", removeError);
      // nie przerywamy – nadal usuwamy z DB
    }
  }

  // 3) wyrzuć URL z tablicy
  const newPhotos = currentPhotos.filter((p) => p !== photoUrl);

  const { error: updateError } = await supabase
    .from("project_tasks")
    .update({ photos: newPhotos })
    .eq("id", taskId)
    .limit(1);

  if (updateError) {
    console.error("deleteTaskPhoto update error:", updateError);
    throw new Error("Nie udało się zaktualizować zadania po usunięciu zdjęcia.");
  }

  // 4) rewalidacja widoków
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/tasks");
  if (placeId) {
    revalidatePath(`/object/${placeId}`);
  }
}

/**
 * Dedykowana akcja do uploadu zdjęć z klienta (drag&drop + kolejne wybory),
 * pilnująca limitu 3 zdjęć łącznie na zadanie.
 */
export async function uploadTaskPhotos(formData: FormData) {
  const taskId = String(formData.get("task_id") ?? "").trim();
  if (!taskId) throw new Error("Brak task_id.");

  const files = formData.getAll("photos") as File[];
  if (!files || files.length === 0) {
    return;
  }

  const supabase = await db();

  // obecne zdjęcia + place_id
  const { data: existingRow, error: existingError } = await supabase
    .from("project_tasks")
    .select("photos, place_id")
    .eq("id", taskId)
    .maybeSingle();

  if (existingError) {
    console.error("uploadTaskPhotos existingRow error:", existingError);
    throw new Error("Nie udało się pobrać zadania.");
  }
  if (!existingRow) {
    throw new Error("Zadanie nie istnieje.");
  }

  let currentPhotos: string[] = [];
  if (Array.isArray((existingRow as any).photos)) {
    currentPhotos = (existingRow as any).photos.filter(
      (p: unknown): p is string => typeof p === "string"
    );
  }

  const placeId: string | null = (existingRow as any).place_id ?? null;
  const maxTotal = 3;

  if (currentPhotos.length >= maxTotal) {
    // już pełny limit
    return;
  }

  const remainingSlots = maxTotal - currentPhotos.length;
  const filesToUpload = files.slice(0, remainingSlots);

  const uploadedUrls: string[] = [];

  for (const file of filesToUpload) {
    if (!file || typeof file.name !== "string") continue;

    const path = `tasks/${taskId}/${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("task-images")
      .upload(path, file);

    if (uploadError) {
      console.error("uploadTaskPhotos upload error:", uploadError);
      continue;
    }

    const { data: urlData } = supabase.storage
      .from("task-images")
      .getPublicUrl(path);

    if (urlData?.publicUrl) {
      uploadedUrls.push(urlData.publicUrl);
    }
  }

  if (uploadedUrls.length === 0) {
    return;
  }

  const newPhotos = [...currentPhotos, ...uploadedUrls].slice(0, maxTotal);

  const { error: updateError } = await supabase
    .from("project_tasks")
    .update({ photos: newPhotos })
    .eq("id", taskId)
    .limit(1);

  if (updateError) {
    console.error("uploadTaskPhotos update error:", updateError);
    throw new Error("Nie udało się zaktualizować zdjęć zadania.");
  }

  // rewalidacja
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/tasks");
  if (placeId) {
    revalidatePath(`/object/${placeId}`);
  }
}

/**
 * Soft delete zadania:
 * - ustawia deleted_at = now()
 * - NIE rusza powiązań (raporty dzienne, itp.)
 * - dzięki temu w przyszłości raporty mogą nadal linkować do tego zadania
 */
export async function softDeleteTask(formData: FormData) {
  const taskId = String(formData.get("task_id") ?? "").trim();
  if (!taskId) throw new Error("Brak task_id.");

  const supabase = await db();

  // potrzebujemy place_id do rewalidacji i redirectu
  const { data: existingRow, error: existingError } = await supabase
    .from("project_tasks")
    .select("place_id")
    .eq("id", taskId)
    .maybeSingle();

  if (existingError) {
    console.error("softDeleteTask existingRow error:", existingError);
    throw new Error("Nie udało się pobrać zadania.");
  }
  if (!existingRow) {
    throw new Error("Zadanie nie istnieje.");
  }

  const placeId: string | null = (existingRow as any).place_id ?? null;

  const { error: updateError } = await supabase
    .from("project_tasks")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", taskId)
    .is("deleted_at", null)
    .limit(1);

  if (updateError) {
    console.error("softDeleteTask update error:", updateError);
    throw new Error("Nie udało się usunąć zadania.");
  }

  // odśwież listy
  revalidatePath("/tasks");
  if (placeId) {
    revalidatePath(`/object/${placeId}`);
  }

  // przekierowanie po usunięciu:
  if (placeId) {
    redirect(`/object/${placeId}`);
  }

  redirect("/tasks");
}
