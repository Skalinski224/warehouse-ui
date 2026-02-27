// src/app/(app)/daily-reports/actions.ts
"use server";

import { supabaseServer } from "@/lib/supabaseServer";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { can, canAny, PERM, type PermissionSnapshot } from "@/lib/permissions";

/* -------------------------------------------------------------------------- */
/*                           Typ payloadu (TS helper)                         */
/* -------------------------------------------------------------------------- */

export type NewDailyReportPayload = {
  date: string; // YYYY-MM-DD
  person: string;

  // ✅ NOWE (KANON): lokacja magazynowa (required)
  inventoryLocationId: string;

  location: string | null; // UI: ignorujemy w DB (legacy)
  place: string | null;
  stageId: string | null;

  crewMode: "crew" | "solo" | "ad_hoc";
  mainCrewId: string | null;
  mainCrewMemberIds: string[];
  extraCrews: { crewId: string }[];
  extraMembers: { memberId: string }[];

  taskId: string | null;
  taskName: string | null;
  isCompleted: boolean;

  images: string[]; // PATHY w storage (nie URL-e)
  items: { materialId: string; qtyUsed: number }[];

  notes: string | null;
};

/* -------------------------------------------------------------------------- */
/*                             Walidacja przez Zod                            */
/* -------------------------------------------------------------------------- */

const ItemSchema = z.object({
  materialId: z.string().uuid(),
  qtyUsed: z.number().positive(),
});

const NewDailyReportSchema = z.object({
  date: z.string().min(1),
  person: z.string().min(1),

  // ✅ NOWE
  inventoryLocationId: z.string().uuid(),

  location: z.string().nullable(),
  place: z.string().nullable(),
  stageId: z.string().uuid().nullable(),

  crewMode: z.enum(["crew", "solo", "ad_hoc"]),
  mainCrewId: z.string().uuid().nullable(),
  mainCrewMemberIds: z.array(z.string().uuid()),
  extraCrews: z.array(z.object({ crewId: z.string().uuid() })),
  extraMembers: z.array(z.object({ memberId: z.string().uuid() })),

  taskId: z.string().uuid().nullable(),
  taskName: z.string().nullable(),
  isCompleted: z.boolean(),

  images: z.array(z.string()).max(3),
  items: z.array(ItemSchema),

  notes: z.string().max(2000).nullable(),
});

/* -------------------------------------------------------------------------- */
/*                          Helper: permissions snapshot                       */
/* -------------------------------------------------------------------------- */

function coerceSnapshot(data: any): PermissionSnapshot | null {
  if (!data) return null;
  if (Array.isArray(data)) return (data[0] as PermissionSnapshot | null) ?? null;
  return data as PermissionSnapshot;
}

async function getPermSnapshot(supabase: any): Promise<PermissionSnapshot> {
  const { data, error } = await supabase.rpc("my_permissions_snapshot");
  const snap = coerceSnapshot(data);
  if (error || !snap) throw new Error("Brak uprawnień (snapshot).");
  return snap;
}

function randId() {
  return Math.random().toString(36).slice(2);
}

function safeFileName(name: string) {
  const safe = String(name || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
  return safe.length > 180 ? safe.slice(-180) : safe;
}

/* -------------------------------------------------------------------------- */
/*                  Server action: uploadDailyReportPhotos                     */
/* -------------------------------------------------------------------------- */

export async function uploadDailyReportPhotos(formData: FormData) {
  const supabase = await supabaseServer();
  const snapshot = await getPermSnapshot(supabase);

  const canEditReport = canAny(snapshot, [
    PERM.DAILY_REPORTS_CREATE,
    PERM.DAILY_REPORTS_UPDATE_UNAPPROVED,
  ]);
  const canUploadPhotos = can(snapshot, PERM.DAILY_REPORTS_PHOTOS_UPLOAD);

  if (!canEditReport || !canUploadPhotos) {
    throw new Error("Brak uprawnień do dodawania zdjęć raportu dziennego.");
  }

  const accountId = snapshot.account_id ? String(snapshot.account_id) : "";
  if (!accountId) throw new Error("Brak wybranego konta (account_id).");

  const reportIdRaw = formData.get("report_id");
  const reportId = typeof reportIdRaw === "string" ? reportIdRaw.trim() : "";

  const draftKeyRaw = formData.get("draft_key");
  const draftKey = typeof draftKeyRaw === "string" ? draftKeyRaw.trim() : "";

  const folderKey = reportId || draftKey;
  if (!folderKey) throw new Error("Brak report_id lub draft_key.");

  const looksUuid = /^[0-9a-fA-F-]{36}$/.test(folderKey);
  const looksDraft = /^draft-[a-z0-9-]{6,}$/i.test(folderKey);
  if (!looksUuid && !looksDraft) {
    throw new Error("Niepoprawny identyfikator zdjęć (report_id/draft_key).");
  }

  const files = formData.getAll("photos") as File[];
  const uploaded: string[] = [];
  if (!files || files.length === 0) return { paths: uploaded };

  const maxFiles = 3;
  const filesToUpload = files.slice(0, maxFiles);

  for (const file of filesToUpload) {
    if (!file || typeof file.name !== "string") continue;

    const name = safeFileName(file.name);
    const path = `${accountId}/daily-reports/${folderKey}/${Date.now()}-${randId()}-${name}`;

    const { error: uploadError } = await supabase.storage
      .from("report-images")
      .upload(path, file, { upsert: false });

    if (uploadError) {
      console.error("[uploadDailyReportPhotos] upload error:", uploadError);
      continue;
    }

    uploaded.push(path);
  }

  return { paths: uploaded };
}

/* -------------------------------------------------------------------------- */
/*                   Server action: deleteDailyReportPhoto                     */
/* -------------------------------------------------------------------------- */

export async function deleteDailyReportPhoto(path: string) {
  const supabase = await supabaseServer();
  const snapshot = await getPermSnapshot(supabase);

  const canEditReport = canAny(snapshot, [
    PERM.DAILY_REPORTS_CREATE,
    PERM.DAILY_REPORTS_UPDATE_UNAPPROVED,
  ]);
  const canDelete = can(snapshot, PERM.DAILY_REPORTS_PHOTOS_DELETE);

  if (!canEditReport || !canDelete) {
    throw new Error("Brak uprawnień do usuwania zdjęć raportu dziennego.");
  }

  const p = String(path || "").trim();
  if (!p) throw new Error("Brak ścieżki pliku.");

  const { error } = await supabase.storage.from("report-images").remove([p]);
  if (error) {
    console.error("[deleteDailyReportPhoto] remove error:", error);
    throw new Error(error.message || "Nie udało się usunąć pliku.");
  }

  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/*                    Helper: aktualny członek i jego brygada                  */
/* -------------------------------------------------------------------------- */

type CurrentMemberInfo = { memberId: string | null; crewId: string | null };

async function getCurrentMemberInfo(supabase: any): Promise<CurrentMemberInfo> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) throw new Error("Brak zalogowanego użytkownika.");

  const { data: member, error: memberError } = await supabase
    .from("team_members")
    .select("id, crew_id")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (memberError) console.error("[daily-reports/actions] team_members error:", memberError);

  return {
    memberId: (member?.id as string | undefined) ?? null,
    crewId: (member?.crew_id as string | undefined) ?? null,
  };
}

/* -------------------------------------------------------------------------- */
/*                      Helper: normalizacja payloadu                          */
/* -------------------------------------------------------------------------- */

function normalizePayload(p: NewDailyReportPayload): NewDailyReportPayload {
  const person = String(p.person || "").trim();

  return {
    ...p,
    person,

    // ✅ twardo
    inventoryLocationId: String(p.inventoryLocationId || "").trim(),

    place: p.place && String(p.place).trim().length > 0 ? String(p.place).trim() : null,
    location: null, // DB nie potrzebuje
    taskName: null, // zawsze z DB (o ile taskId istnieje)
    images: Array.isArray(p.images) ? p.images.slice(0, 3) : [],
    items: Array.isArray(p.items) ? p.items.filter((x) => (x?.qtyUsed ?? 0) > 0) : [],
    notes: p.notes && String(p.notes).trim().length > 0 ? String(p.notes).trim() : null,
  };
}

/* -------------------------------------------------------------------------- */
/*            Helper: group_key dla ad_hoc (skład grupy)                       */
/* -------------------------------------------------------------------------- */

function buildAdHocGroupKey(date: string, memberIds: string[]) {
  const ids = Array.from(new Set(memberIds.filter(Boolean))).sort();
  return `${date}::${ids.join(",")}`;
}

function isDuplicateKeyError(e: any): boolean {
  const msg = String(e?.message ?? "").toLowerCase();
  const code = String((e as any)?.code ?? "");
  return code === "23505" || msg.includes("duplicate key value violates unique constraint");
}

/* -------------------------------------------------------------------------- */
/*            Helper: idempotency key (client_key)                             */
/* -------------------------------------------------------------------------- */

function getClientKeyFromFormData(formData: FormData): string {
  const ckRaw = formData.get("client_key");
  const dkRaw = formData.get("draft_key");

  const ck = typeof ckRaw === "string" ? ckRaw.trim() : "";
  const dk = typeof dkRaw === "string" ? dkRaw.trim() : "";

  const key = ck || dk;
  if (!key) throw new Error("Brak client_key (idempotency).");

  if (key.length < 8) throw new Error("client_key za krótki.");
  if (key.length > 120) throw new Error("client_key za długi.");

  return key;
}

async function findExistingByClientKey(params: {
  supabase: any;
  accountId: string;
  clientKey: string;
}): Promise<{ id: string; approved: boolean } | null> {
  const { supabase, accountId, clientKey } = params;

  const { data, error } = await supabase
    .from("daily_reports")
    .select("id, approved")
    .eq("account_id", accountId)
    .eq("client_key", clientKey)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error("[findExistingByClientKey] error:", error);
    return null;
  }
  if (!data?.id) return null;

  return { id: String(data.id), approved: !!(data as any).approved };
}

/* -------------------------------------------------------------------------- */
/*                           Server action: createDailyReport                  */
/* -------------------------------------------------------------------------- */

export async function createDailyReport(formData: FormData) {
  const json = formData.get("payload");
  if (!json || typeof json !== "string") throw new Error("Invalid payload");

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(json);
  } catch (e) {
    console.error("[createDailyReport] JSON.parse error:", e);
    throw new Error("Invalid JSON payload");
  }

  const parsed = NewDailyReportSchema.safeParse(parsedJson);
  if (!parsed.success) {
    console.error("[createDailyReport] validation error:", parsed.error.format());
    throw new Error("Invalid data");
  }

  let payload = normalizePayload(parsed.data as NewDailyReportPayload);

  // ✅ twardo: lokacja musi istnieć
  if (!payload.inventoryLocationId) {
    throw new Error("Wybierz lokalizację magazynową.");
  }

  const supabase = await supabaseServer();
  const snapshot = await getPermSnapshot(supabase);

  if (!can(snapshot, PERM.DAILY_REPORTS_CREATE)) {
    throw new Error("Brak uprawnień do dodawania raportów dziennych.");
  }

  const accountId = snapshot.account_id ? String(snapshot.account_id) : "";
  if (!accountId) throw new Error("Brak wybranego konta (account_id).");

  const clientKey = getClientKeyFromFormData(formData);

  const { memberId: currentMemberId, crewId: currentCrewId } = await getCurrentMemberInfo(supabase);
  if (!currentMemberId) {
    throw new Error("Brak przypisanego team_member dla użytkownika (reporter_member_id).");
  }

  /* ----------------------- 1) Tryb pracy: crew/solo/ad_hoc ----------------------- */

  let crewIdToSave: string | null = null;
  let crewNameToSave = "";
  let crewModeToSave: "crew" | "solo" | "ad_hoc" = payload.crewMode;
  let adHocGroupKeyToSave: string | null = null;

  if (payload.crewMode === "crew") {
    if (!currentCrewId) {
      throw new Error(
        "Nie możesz tworzyć raportu jako brygada – nie jesteś przypisany do żadnej brygady."
      );
    }

    crewIdToSave = currentCrewId;
    crewModeToSave = "crew";

    const { data: crewMembers, error: crewMembersError } = await supabase
      .from("team_members")
      .select("id")
      .eq("crew_id", crewIdToSave)
      .is("deleted_at", null);

    if (crewMembersError) {
      console.error("[createDailyReport] crew members fetch error:", crewMembersError);
      throw new Error("Nie udało się zweryfikować członków brygady.");
    }

    const ownCrewIds = new Set<string>((crewMembers ?? []).map((m: any) => String(m.id)));
    let mainIds = Array.from(new Set(payload.mainCrewMemberIds ?? []));

    if (mainIds.length === 0 && ownCrewIds.size > 0) mainIds = Array.from(ownCrewIds);
    if (!mainIds.includes(currentMemberId)) mainIds.push(currentMemberId);

    payload = {
      ...payload,
      mainCrewId: crewIdToSave,
      mainCrewMemberIds: mainIds,
      extraCrews: [],
      extraMembers: [],
    };

    const { data: mainCrew } = await supabase
      .from("crews")
      .select("name")
      .eq("id", crewIdToSave)
      .maybeSingle();

    crewNameToSave = String((mainCrew as any)?.name ?? "").trim();
  }

  if (payload.crewMode === "solo") {
    crewIdToSave = null;
    crewModeToSave = "solo";
    payload = {
      ...payload,
      mainCrewId: null,
      mainCrewMemberIds: [],
      extraCrews: [],
      extraMembers: [],
    };
  }

  if (payload.crewMode === "ad_hoc") {
    crewIdToSave = null;
    crewModeToSave = "ad_hoc";

    const ids = payload.extraMembers.map((m) => m.memberId).filter(Boolean);
    if (!ids.includes(currentMemberId)) ids.push(currentMemberId);

    if (ids.length < 2) {
      throw new Error('Tryb "grupa niezorganizowana" wymaga co najmniej 2 osób.');
    }

    payload = {
      ...payload,
      mainCrewId: null,
      mainCrewMemberIds: [],
      extraCrews: [],
      extraMembers: ids.map((id) => ({ memberId: id })),
    };

    adHocGroupKeyToSave = buildAdHocGroupKey(payload.date, ids);
  }

  /* ----------------------- 2) Zadanie: walidacja + place ------------------------ */

  if (payload.taskId) {
    const { data: task, error: taskError } = await supabase
      .from("project_tasks")
      .select("id, title, place_id, assigned_crew_id, assigned_member_id")
      .eq("id", payload.taskId)
      .is("deleted_at", null)
      .maybeSingle();

    if (taskError) {
      console.error("[createDailyReport] project_tasks error:", taskError);
      throw new Error("Nie udało się zweryfikować zadania.");
    }
    if (!task) throw new Error("Wybrane zadanie nie istnieje.");

    const taskTitle = ((task as any).title as string | null) ?? null;
    const taskCrewId = ((task as any).assigned_crew_id as string | null) ?? null;
    const taskMemberId = ((task as any).assigned_member_id as string | null) ?? null;

    if (crewModeToSave === "crew") {
      if (taskCrewId && crewIdToSave && taskCrewId !== crewIdToSave) {
        throw new Error("To zadanie nie jest przypisane do Twojej brygady – nie możesz go raportować.");
      }
    } else {
      if (taskMemberId && taskMemberId !== currentMemberId) {
        throw new Error("To zadanie nie jest przypisane do Ciebie – nie możesz go raportować.");
      }
    }

    let placeName: string | null = payload.place;
    const placeId = (task as any).place_id as string | null;

    if (placeId) {
      const { data: place } = await supabase
        .from("project_places")
        .select("name")
        .eq("id", placeId)
        .maybeSingle();
      if ((place as any)?.name) placeName = String((place as any).name);
    }

    payload = { ...payload, taskName: taskTitle, place: placeName ?? null };
  } else {
    payload = { ...payload, taskName: null };
  }

  /* ----------------------------- 3) Insert daily_reports ----------------------- */

  const insertRow: any = {
    account_id: accountId,
    client_key: clientKey,

    date: payload.date,
    person: payload.person,
    place: payload.place,
    stage_id: payload.stageId,

    // ✅ NOWE: zapis lokacji
    inventory_location_id: payload.inventoryLocationId,

    crew_id: crewIdToSave,
    crew_name: crewNameToSave,

    crew_mode: crewModeToSave,
    reporter_member_id: currentMemberId,
    ad_hoc_group_key: adHocGroupKeyToSave,

    task_id: payload.taskId,
    task_name: payload.taskName,

    is_completed: payload.isCompleted,

    images: payload.images.length > 0 ? payload.images : null,
    items: payload.items.map((i) => ({ material_id: i.materialId, qty_used: i.qtyUsed })),
    notes: payload.notes,

    approved: false,
    submitted_at: new Date().toISOString(),
  };

  const { data: report, error: insertError } = await supabase
    .from("daily_reports")
    .insert(insertRow)
    .select("id, approved")
    .single();

  if (insertError || !report?.id) {
    console.error("[createDailyReport] insert daily_reports error:", insertError);

    if (isDuplicateKeyError(insertError)) {
      const existing = await findExistingByClientKey({ supabase, accountId, clientKey });
      if (existing) return { id: existing.id, approved: existing.approved };
    }

    throw new Error(insertError?.message || "Failed to create daily report");
  }

  const reportId = String((report as any).id);

  /* ----------------------------- 4) daily_report_members ---------------------- */

  const memberRows: { report_id: string; member_id: string }[] = [];
  payload.mainCrewMemberIds.forEach((id) => memberRows.push({ report_id: reportId, member_id: id }));
  payload.extraMembers.forEach((m) => memberRows.push({ report_id: reportId, member_id: m.memberId }));

  if (memberRows.length > 0) {
    const { error: membersError } = await supabase.from("daily_report_members").insert(memberRows);
    if (membersError) console.error("[createDailyReport] insert daily_report_members error:", membersError);
  }

  revalidatePath("/daily-reports");
  revalidatePath("/reports/daily");

  return { id: reportId, approved: false };
}



/* -------------------------------------------------------------------------- */
/*                   Server action: approveDailyReport (manual)                */
/* -------------------------------------------------------------------------- */
/**
 * APPROVE = przyjęcie do systemu:
 *  - zawsze zmienia magazyn (subtract_usage_and_update_stock)
 *  - zmienia task status TYLKO jeśli raport ma is_completed=true (checkbox)
 *  - worker/foreman NIE mają tej permisji
 */
export async function approveDailyReport(reportId: string) {
  if (!reportId || typeof reportId !== "string") throw new Error("Invalid report id");

  const supabase = await supabaseServer();
  const snapshot = await getPermSnapshot(supabase);

  if (!can(snapshot, PERM.DAILY_REPORTS_APPROVE)) {
    throw new Error("Brak uprawnień do zatwierdzania raportów dziennych.");
  }

  const { data: dr, error: drErr } = await supabase
    .from("daily_reports")
    .select("id, approved")
    .eq("id", reportId)
    .is("deleted_at", null)
    .maybeSingle();

  if (drErr || !dr) throw new Error("Raport nie istnieje lub brak dostępu.");
  if ((dr as any).approved) return { ok: true };

  // 1) stock + approve w DB
  const { error: stockErr } = await supabase.rpc("subtract_usage_and_update_stock", {
    p_report_id: reportId,
  });

  if (stockErr) {
    console.error("[approveDailyReport] subtract_usage_and_update_stock error:", stockErr);
    throw new Error(stockErr.message || "Failed to approve daily report");
  }

  // 2) domknięcie taska po approve (SECURITY DEFINER)
  //    - jeśli raport nie ma task_id albo is_completed=false -> RPC zrobi return (nic nie zmieni)
  const { error: doneErr } = await supabase.rpc("complete_task_from_daily_report", {
    p_report_id: reportId,
  });

  // UWAGA: TU NIE LOGUJEMY TYLKO WALIMY ERROR,
  // bo inaczej znowu będziesz myślał że "działa"
  if (doneErr) {
    console.error("[approveDailyReport] complete_task_from_daily_report error:", doneErr);
    throw new Error(doneErr.message || "Nie udało się domknąć zadania z raportu.");
  }

  revalidatePath("/daily-reports");
  revalidatePath("/reports/daily");
  revalidatePath(`/reports/daily/${reportId}`);

  // task pages
  revalidatePath("/tasks");
  revalidatePath("/my-tasks");

  return { ok: true };
}


/* -------------------------------------------------------------------------- */
/*                   Server action: deleteDailyReportUnapproved                */
/* -------------------------------------------------------------------------- */

export async function deleteDailyReportUnapproved(reportId: string) {
  if (!reportId || typeof reportId !== "string") throw new Error("Invalid report id");

  const supabase = await supabaseServer();
  const snapshot = await getPermSnapshot(supabase);

  if (!can(snapshot, PERM.DAILY_REPORTS_DELETE_UNAPPROVED)) {
    throw new Error("Brak uprawnień do usuwania raportów oczekujących.");
  }

  const { error } = await supabase
    .from("daily_reports")
    .delete()
    .eq("id", reportId)
    .eq("approved", false)
    .limit(1);

  if (error) {
    console.error("[deleteDailyReportUnapproved] delete error:", error);
    throw new Error(error.message || "Nie udało się usunąć raportu.");
  }

  revalidatePath("/daily-reports");
  revalidatePath("/reports/daily");

  return { ok: true };
}
