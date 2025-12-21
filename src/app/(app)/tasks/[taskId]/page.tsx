// src/app/(app)/tasks/[taskId]/page.tsx
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { supabaseServer } from "@/lib/supabaseServer";
import BackButton from "@/components/BackButton";
import TaskStatusBadge from "@/components/object/TaskStatusBadge";
import TaskPhotosLightbox, { type TaskPhotoItem } from "@/components/tasks/TaskPhotosLightbox";
import TaskPhotosUploader from "@/components/tasks/TaskPhotosUploader";

import { updateTaskManager, deleteTaskPhoto, softDeleteTask } from "../actions";
import { PERM, can, type PermissionSnapshot } from "@/lib/permissions";

type TaskStatus = "todo" | "in_progress" | "done";

type CrewOption = { id: string; name: string };
type MemberOption = { id: string; label: string };

type PlaceRow = { id: string; name: string | null; parent_id: string | null };
export type PlaceCrumb = { id: string; name: string };

type TaskDetailsRow = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  place_id: string;
  created_at: string;
  created_by: string | null;
  assigned_crew_id: string | null;
  assigned_member_id: string | null;

  // ⚠️ Supabase dla relacji many-to-one często zwraca OBIEKT, nie tablicę.
  // Zostawiamy typ „luźny” i normalizujemy w kodzie.
  crews?: any;
  team_members?: any;
};

type TaskDetails = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  createdAt: string;
  placeId: string;
  crewId: string | null;
  crewName: string | null;
  memberId: string | null;
  memberLabel: string | null;
  createdByLabel: string | null;
  photos: TaskPhotoItem[];
  placeChain: PlaceCrumb[];
};

async function fetchMyPermissionsSnapshot(): Promise<PermissionSnapshot | null> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("my_permissions_snapshot");
  if (error) {
    console.error("my_permissions_snapshot error:", error);
    return null;
  }
  const snap = Array.isArray(data) ? (data[0] ?? null) : (data ?? null);
  return (snap as PermissionSnapshot | null) ?? null;
}

async function buildPlaceChain(placeId: string): Promise<PlaceCrumb[]> {
  const supabase = await supabaseServer();

  const chain: PlaceCrumb[] = [];
  let cursorId: string | null = placeId;

  while (cursorId) {
    const res: { data: PlaceRow | null; error: any } = await supabase
      .from("project_places")
      .select("id, name, parent_id")
      .eq("id", cursorId)
      .is("deleted_at", null)
      .maybeSingle<PlaceRow>();

    if (res.error) {
      console.error("buildPlaceChain error:", res.error);
      break;
    }

    const row: PlaceRow | null = res.data;
    if (!row) break;

    chain.push({ id: row.id, name: row.name ?? "" });
    cursorId = row.parent_id;
  }

  return chain.reverse();
}

function normalizeStoragePath(p: string): string {
  const raw = String(p ?? "").trim();
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      const u = new URL(raw);
      const pathname = u.pathname || "";
      const marker = "/storage/v1/object/";
      const i = pathname.indexOf(marker);
      if (i >= 0) {
        const rest = pathname.slice(i + marker.length); // "public/task-images/.."
        const parts = rest.split("/").filter(Boolean);
        if (parts.length >= 3) return decodeURIComponent(parts.slice(2).join("/"));
      }
      return decodeURIComponent(pathname.replace(/^\/+/, ""));
    } catch {
      return raw;
    }
  }
  return raw.replace(/^\/+/, "");
}

async function signTaskImageUrls(rows: { id: string; path: string }[]): Promise<TaskPhotoItem[]> {
  const supabase = await supabaseServer();

  const out: TaskPhotoItem[] = [];
  for (const r of rows) {
    const path = normalizeStoragePath(r.path);
    if (!path) continue;

    const { data, error } = await supabase.storage.from("task-images").createSignedUrl(path, 60 * 60);
    if (error) {
      console.error("createSignedUrl error:", error);
      continue;
    }
    if (!data?.signedUrl) continue;

    out.push({ id: r.id, url: data.signedUrl, path });
  }

  return out;
}

function normalizeRelOne<T extends object>(rel: any): T | null {
  if (!rel) return null;
  if (Array.isArray(rel)) return (rel[0] ?? null) as T | null;
  if (typeof rel === "object") return rel as T;
  return null;
}

async function fetchTask(taskId: string): Promise<TaskDetails | null> {
  const supabase = await supabaseServer();

  const taskRes = await supabase
    .from("project_tasks")
    .select(
      `
        id,
        title,
        description,
        status,
        place_id,
        created_at,
        created_by,
        assigned_crew_id,
        assigned_member_id,
        crews ( id, name ),
        team_members ( id, first_name, last_name, email )
      `
    )
    .eq("id", taskId)
    .is("deleted_at", null)
    .maybeSingle()
    .returns<TaskDetailsRow>();

  if (taskRes.error) {
    console.error("fetchTask error:", taskRes.error);
    return null;
  }
  if (!taskRes.data) return null;

  const row = taskRes.data;

  const attRes = await supabase
    .from("task_attachments")
    .select("id, url, created_at")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  if (attRes.error) {
    console.error("fetchTask attachments error:", attRes.error);
  }

  const signedPhotos = await signTaskImageUrls(
    (attRes.data ?? []).map((x: any) => ({ id: String(x.id), path: String(x.url) }))
  );

  // ✅ FIX: relacje one-to-many vs many-to-one – ujednolicamy (obiekt albo tablica)
  const crewObj = normalizeRelOne<{ id: string; name: string | null }>((row as any).crews);
  const crewName = crewObj?.name != null && String(crewObj.name).trim() ? String(crewObj.name) : null;

  const memberObj = normalizeRelOne<{
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  }>((row as any).team_members);

  let memberLabel: string | null = null;
  if (memberObj) {
    const f = (memberObj.first_name ?? "").trim();
    const l = (memberObj.last_name ?? "").trim();
    const e = (memberObj.email ?? "").trim();
    const namePart = [f, l].filter(Boolean).join(" ");
    memberLabel = namePart || e || null;
  }

  let createdByLabel: string | null = null;
  if (row.created_by) {
    const creatorRes = await supabase
      .from("v_account_members_overview")
      .select("first_name, last_name, email")
      .eq("user_id", row.created_by)
      .maybeSingle();

    if (creatorRes.error) {
      console.error("creator lookup error:", creatorRes.error);
    } else if (creatorRes.data) {
      const f = ((creatorRes.data as any).first_name as string | null) ?? "";
      const l = ((creatorRes.data as any).last_name as string | null) ?? "";
      const e = ((creatorRes.data as any).email as string | null) ?? "";
      createdByLabel = f || l ? [f, l].filter(Boolean).join(" ") : e || null;
    }
  }

  const placeChain = await buildPlaceChain(row.place_id);

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    createdAt: row.created_at,
    placeId: row.place_id,
    crewId: row.assigned_crew_id,
    crewName,
    memberId: row.assigned_member_id,
    memberLabel,
    createdByLabel,
    photos: signedPhotos,
    placeChain,
  };
}

async function fetchCrewOptions(): Promise<CrewOption[]> {
  const supabase = await supabaseServer();
  const res = await supabase.from("crews").select("id, name").order("name", { ascending: true });

  if (res.error) {
    console.error("fetchCrewOptions error:", res.error);
    return [];
  }

  return (res.data ?? []).map((r: any) => ({
    id: String(r.id),
    name: String(r.name ?? ""),
  }));
}

async function fetchMemberOptions(): Promise<MemberOption[]> {
  const supabase = await supabaseServer();
  const res = await supabase
    .from("team_members")
    .select("id, first_name, last_name, email, status")
    .is("deleted_at", null)
    .eq("status", "active")
    .order("first_name", { ascending: true });

  if (res.error) {
    console.error("fetchMemberOptions error:", res.error);
    return [];
  }

  return (res.data ?? []).map((row: any) => {
    const first = (row.first_name as string | null) ?? "";
    const last = (row.last_name as string | null) ?? "";
    const email = (row.email as string | null) ?? "";
    const namePart = [first, last].filter(Boolean).join(" ");
    const label = namePart || email || "Bez nazwy";
    return { id: String(row.id), label };
  });
}

/**
 * worker/storeman: widzą tylko swoje zadania.
 * -> sprawdzamy scope:
 *    - assigned_member_id w team_members usera
 *    - lub assigned_crew_id w crew_id usera
 */
async function canSeeTaskOwnScope(taskId: string, userId: string): Promise<boolean> {
  const supabase = await supabaseServer();

  const { data: tmRows, error: tmErr } = await supabase
    .from("team_members")
    .select("id, crew_id")
    .eq("user_id", userId)
    .is("deleted_at", null);

  if (tmErr) {
    console.error("canSeeTaskOwnScope team_members error:", tmErr);
    return false;
  }

  const memberIds = (tmRows ?? [])
    .map((x: any) => x.id as string | null)
    .filter((x): x is string => !!x);

  const crewIds = (tmRows ?? [])
    .map((x: any) => x.crew_id as string | null)
    .filter((x): x is string => !!x);

  if (memberIds.length === 0 && crewIds.length === 0) return false;

  if (memberIds.length > 0) {
    const { data, error } = await supabase
      .from("project_tasks")
      .select("id")
      .eq("id", taskId)
      .in("assigned_member_id", memberIds)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) console.error("canSeeTaskOwnScope member check error:", error);
    if (data?.id) return true;
  }

  if (crewIds.length > 0) {
    const { data, error } = await supabase
      .from("project_tasks")
      .select("id")
      .eq("id", taskId)
      .in("assigned_crew_id", crewIds)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) console.error("canSeeTaskOwnScope crew check error:", error);
    if (data?.id) return true;
  }

  return false;
}

function fmtWhen(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pl-PL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getSp(sp: { [k: string]: string | string[] | undefined } | undefined, key: string) {
  const v = sp?.[key];
  return Array.isArray(v) ? v[0] : v;
}

function AutoHideToastScript({ id }: { id: string }) {
  const js = `
  (function(){
    try {
      var el = document.getElementById(${JSON.stringify(id)});
      if (!el) return;
      window.setTimeout(function(){
        try {
          el.style.transition = 'opacity 200ms ease';
          el.style.opacity = '0';
          window.setTimeout(function(){ el.remove(); }, 220);
        } catch(e) {}
      }, 5000);
    } catch(e) {}
  })();`;
  // eslint-disable-next-line react/no-danger
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}

type PageProps = {
  params: Promise<{ taskId: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function TaskDetailsPage({ params, searchParams }: PageProps) {
  const { taskId } = await params;
  const spObj = searchParams ? await searchParams : undefined;

  const supabase = await supabaseServer();
  const [{ data: auth }, snapshot] = await Promise.all([
    supabase.auth.getUser(),
    fetchMyPermissionsSnapshot(),
  ]);

  const user = auth?.user ?? null;
  if (!user) notFound();

  const canReadAll = can(snapshot, PERM.TASKS_READ_ALL);
  const canReadOwn = can(snapshot, PERM.TASKS_READ_OWN);
  if (!canReadAll && !canReadOwn) notFound();

  const [task, crewOptions, memberOptions] = await Promise.all([
    fetchTask(taskId),
    canReadAll ? fetchCrewOptions() : Promise.resolve([]),
    canReadAll ? fetchMemberOptions() : Promise.resolve([]),
  ]);

  if (!task) notFound();

  if (!canReadAll) {
    const allowed = await canSeeTaskOwnScope(taskId, user.id);
    if (!allowed) notFound();
  }

  const canManage = can(snapshot, PERM.TASKS_UPDATE_ALL) || can(snapshot, PERM.TASKS_ASSIGN);
  const canDelete = can(snapshot, PERM.TASKS_UPDATE_ALL);
  const canUploadPhotos = can(snapshot, PERM.TASKS_UPLOAD_PHOTOS);
  const canDeletePhoto = can(snapshot, PERM.TASKS_UPDATE_ALL);

  const saved = getSp(spObj, "saved") === "1";

  async function saveTask(formData: FormData) {
    "use server";
    await updateTaskManager(formData);
    const id = String(formData.get("task_id") ?? "");
    redirect(`/tasks/${id}?saved=1`);
  }

  async function deleteTask(formData: FormData) {
    "use server";
    await softDeleteTask(formData);
    redirect(`/tasks?deleted=1`);
  }

  const assignedMemberText = task.memberLabel ?? "— brak osoby —";
  const assignedCrewText = task.crewName ?? "— brak brygady —";

  return (
    <div className="p-6 space-y-6">
      {/* Back w prawym górnym rogu */}
      <div className="flex items-center justify-end">
        <BackButton className="inline-flex border border-border rounded px-3 py-2 bg-card hover:bg-card/80 text-sm" />
      </div>

      {/* ✅ Lokalizacja bardziej wyrazna */}
      <div className="border border-border rounded-xl bg-card p-4">
        <div className="text-[11px] text-foreground/60 mb-2">Lokalizacja</div>
        <div className="flex flex-wrap gap-2">
          {task.placeChain.map((p, idx) => (
            <span key={p.id} className="inline-flex items-center gap-2">
              <Link
                href={`/object/${p.id}`}
                className="inline-flex items-center rounded-full border border-border bg-background/40 px-3 py-1.5 text-xs font-semibold text-foreground/85 hover:bg-foreground/5 transition"
              >
                {p.name || "—"}
              </Link>
              {idx < task.placeChain.length - 1 ? (
                <span className="text-foreground/30 text-xs">→</span>
              ) : null}
            </span>
          ))}
        </div>
      </div>

      {/* GÓRA: tytuł + status + przypisanie */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold break-words">{task.title}</h1>

            {/* ✅ wyraźnie pokazane przypisanie */}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-foreground/60">Przypisane do:</span>

              {task.memberId ? (
                <span className="inline-flex items-center rounded-full border border-border bg-foreground/10 px-3 py-1 text-[11px] font-semibold text-foreground">
                  Osoba: {assignedMemberText}
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full border border-border bg-background/40 px-3 py-1 text-[11px] text-foreground/70">
                  Osoba: —
                </span>
              )}

              {task.crewId ? (
                <span className="inline-flex items-center rounded-full border border-border bg-foreground/10 px-3 py-1 text-[11px] font-semibold text-foreground">
                  Brygada: {assignedCrewText}
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full border border-border bg-background/40 px-3 py-1 text-[11px] text-foreground/70">
                  Brygada: —
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <TaskStatusBadge status={task.status} />
          </div>
        </div>

        {/* Zdjęcia (zawsze podgląd) */}
        <TaskPhotosLightbox
          photos={task.photos}
          taskId={task.id}
          deleteAction={canDeletePhoto ? deleteTaskPhoto : undefined}
        />

        {/* Uploader ukryty dopóki nie klikniesz */}
        {canManage && canUploadPhotos && (
          <details className="group max-w-md border border-border/60 rounded-xl bg-card/40 overflow-hidden">
            <summary className="cursor-pointer select-none px-4 py-3 text-xs font-semibold text-foreground/80 hover:bg-card/60 transition">
              Dodaj zdjęcie{" "}
              <span className="ml-2 text-[10px] font-normal text-foreground/60">(max 3 łącznie)</span>
            </summary>
            <div className="p-4">
              <TaskPhotosUploader taskId={task.id} existingCount={task.photos.length} />
            </div>
          </details>
        )}
      </div>

      {/* STAŁE INFO */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="border border-border rounded-xl bg-card p-4">
          <div className="text-[11px] text-foreground/60">Kto zlecił</div>
          <div className="text-sm font-semibold">{task.createdByLabel ?? "—"}</div>
        </div>

        <div className="border border-border rounded-xl bg-card p-4">
          <div className="text-[11px] text-foreground/60">Kiedy</div>
          <div className="text-sm font-semibold">{fmtWhen(task.createdAt)}</div>
        </div>

        <div className="border border-border rounded-xl bg-card p-4">
          <div className="text-[11px] text-foreground/60">Status</div>
          <div className="text-sm font-semibold">{task.status}</div>
        </div>
      </div>

      {/* EDYCJA */}
      <form action={saveTask} className="space-y-4">
        <input type="hidden" name="task_id" value={task.id} />
        {/* zachowujemy status (updateTaskManager może oczekiwać) */}
        <input type="hidden" name="status" value={task.status} />

        <div className="border border-border rounded-xl bg-card p-4 space-y-2">
          <div className="text-[11px] text-foreground/60">Tytuł</div>
          {canManage ? (
            <input
              name="title"
              defaultValue={task.title}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-foreground/40 hover:bg-foreground/5 transition"
            />
          ) : (
            <div className="text-sm font-semibold text-foreground/90">{task.title}</div>
          )}
        </div>

        <div className="border border-border rounded-xl bg-card p-4 space-y-2">
          <div className="text-[11px] text-foreground/60">Opis</div>
          {canManage ? (
            <textarea
              name="description"
              rows={5}
              defaultValue={task.description ?? ""}
              placeholder="opis…"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none outline-none focus:ring-1 focus:ring-foreground/40 hover:bg-foreground/5 transition"
            />
          ) : task.description ? (
            <div className="text-sm whitespace-pre-line">{task.description}</div>
          ) : (
            <div className="text-sm text-foreground/60">Brak opisu.</div>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="border border-border rounded-xl bg-card p-4 space-y-2">
            <div className="text-[11px] text-foreground/60">Osoba</div>

            {!canManage ? (
              <div className="text-sm font-semibold">{assignedMemberText}</div>
            ) : (
              <details className="group border border-border/60 rounded-lg bg-background/30">
                <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold hover:bg-foreground/5 rounded-lg transition">
                  {assignedMemberText}
                </summary>
                <div className="p-3 pt-2 space-y-2">
                  <select
                    name="assigned_member_id"
                    defaultValue={task.memberId ?? ""}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-foreground/40 hover:bg-foreground/5 transition"
                  >
                    <option value="">— brak przypisania —</option>
                    {memberOptions.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              </details>
            )}
          </div>

          <div className="border border-border rounded-xl bg-card p-4 space-y-2">
            <div className="text-[11px] text-foreground/60">Brygada</div>

            {!canManage ? (
              <div className="text-sm font-semibold">{assignedCrewText}</div>
            ) : (
              <details className="group border border-border/60 rounded-lg bg-background/30">
                <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold hover:bg-foreground/5 rounded-lg transition">
                  {assignedCrewText}
                </summary>
                <div className="p-3 pt-2 space-y-2">
                  <select
                    name="assigned_crew_id"
                    defaultValue={task.crewId ?? ""}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-foreground/40 hover:bg-foreground/5 transition"
                  >
                    <option value="">— brak przypisania —</option>
                    {crewOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </details>
            )}
          </div>
        </div>

        {/* ✅ STICKY BAR z przyciskami i toastem obok (zawsze widoczny, na dole ekranu) */}
        {canManage && (
          <div className="sticky bottom-4 z-10">
            <div className="mx-auto max-w-4xl rounded-2xl border border-border/60 bg-card/80 backdrop-blur px-4 py-3 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <button
                    className="inline-flex items-center justify-center rounded-full bg-foreground text-background px-6 py-2 text-xs font-semibold hover:bg-foreground/90 transition"
                    type="submit"
                  >
                    Zapisz
                  </button>

                  {canDelete && (
                    <button
                      formAction={deleteTask}
                      type="submit"
                      className="inline-flex w-full sm:w-auto items-center justify-center rounded-full border border-red-500/70 text-red-400 px-6 py-2 text-xs font-semibold hover:bg-red-500/10 transition"
                    >
                      Usuń
                    </button>
                  )}
                </div>

                {/* ✅ Toast obok przycisków (widoczny zawsze, autohide 5s) */}
                {saved ? (
                  <div
                    id="taskSavedToast"
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-background/40 px-4 py-2 text-xs text-foreground/80"
                  >
                    <span className="text-emerald-400">✅</span>
                    Zmiany zostały zapisane.
                    <AutoHideToastScript id="taskSavedToast" />
                  </div>
                ) : (
                  <div className="hidden sm:block text-[11px] text-foreground/45">
                    {/* puste miejsce, żeby układ nie skakał */}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
