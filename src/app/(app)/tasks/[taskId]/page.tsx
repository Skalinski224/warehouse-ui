// src/app/(app)/tasks/[taskId]/page.tsx

import { notFound } from "next/navigation";
import Link from "next/link";

import { supabaseServer } from "@/lib/supabaseServer";
import RoleGuard from "@/components/RoleGuard";
import TaskStatusBadge from "@/components/object/TaskStatusBadge";
import TaskPhotosLightbox from "@/components/tasks/TaskPhotosLightbox";
import TaskPhotosUploader from "@/components/tasks/TaskPhotosUploader";
import {
  updateTaskManager,
  deleteTaskPhoto,
  softDeleteTask,
} from "../actions";

/* -------------------------------------------------------- */
/*                     Typy pomocnicze                      */
/* -------------------------------------------------------- */

type TaskStatus = "todo" | "in_progress" | "done";

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
  photos: unknown;
  crews?: { id: string; name: string | null }[] | null;
  team_members?:
    | {
        id: string;
        first_name: string | null;
        last_name: string | null;
        email: string | null;
      }[]
    | null;
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
  photos: string[];
  placeChain: PlaceCrumb[];
};

type CrewOption = {
  id: string;
  name: string;
};

type MemberOption = {
  id: string;
  label: string;
};

type PlaceRow = {
  id: string;
  name: string | null;
  parent_id: string | null;
};

export type PlaceCrumb = {
  id: string;
  name: string;
};

/* -------------------------------------------------------- */
/*                Budowa łańcucha miejsca                   */
/* -------------------------------------------------------- */

async function buildPlaceChain(placeId: string): Promise<PlaceCrumb[]> {
  const supabase = await supabaseServer();

  const chain: PlaceCrumb[] = [];
  let cursorId: string | null = placeId;

  while (cursorId) {
    const { data, error } = await supabase
      .from("project_places")
      .select("id, name, parent_id")
      .eq("id", cursorId)
      .is("deleted_at", null)
      .maybeSingle<PlaceRow>();

    if (error) {
      console.error("buildPlaceChain error:", error);
      break;
    }
    if (!data) break;

    const placeData = data as PlaceRow;

    chain.push({
      id: placeData.id,
      name: placeData.name ?? "",
    });

    cursorId = placeData.parent_id;
  }

  return chain.reverse();
}

/* -------------------------------------------------------- */
/*          FETCH zadania + dane powiązane                  */
/* -------------------------------------------------------- */

async function fetchTask(taskId: string): Promise<TaskDetails | null> {
  const supabase = await supabaseServer();

  const { data, error } = await supabase
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
        photos,
        crews ( id, name ),
        team_members ( id, first_name, last_name, email )
      `
    )
    .eq("id", taskId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error("fetchTask error:", error);
    return null;
  }
  if (!data) return null;

  const row = data as TaskDetailsRow;

  const crewName =
    Array.isArray(row.crews) && row.crews.length > 0
      ? row.crews[0]?.name ?? null
      : null;

  // Osoba przypisana do zadania
  let memberId: string | null = null;
  let memberLabel: string | null = null;

  if (row.team_members && row.team_members.length > 0) {
    const member = row.team_members[0];
    memberId = member.id;
    const f = (member.first_name as string | null) ?? "";
    const l = (member.last_name as string | null) ?? "";
    const e = (member.email as string | null) ?? "";
    const namePart = [f, l].filter(Boolean).join(" ");
    memberLabel = namePart || e || null;
  }

  // Kto zlecił
  let createdByLabel: string | null = null;
  if (row.created_by) {
    const { data: creator } = await supabase
      .from("v_account_members_overview")
      .select("first_name, last_name, email")
      .eq("user_id", row.created_by)
      .maybeSingle();

    if (creator) {
      const f = (creator as any).first_name as string | null;
      const l = (creator as any).last_name as string | null;
      const e = (creator as any).email as string | null;
      if (f || l) {
        createdByLabel = [f, l].filter(Boolean).join(" ");
      } else if (e) {
        createdByLabel = e;
      }
    }
  }

  const photos =
    Array.isArray(row.photos)
      ? row.photos.filter((p): p is string => typeof p === "string")
      : [];

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
    memberId,
    memberLabel,
    createdByLabel,
    photos,
    placeChain,
  };
}

/* -------------------------------------------------------- */
/*                Brygady / osoby do selecta                */
/* -------------------------------------------------------- */

async function fetchCrewOptions(): Promise<CrewOption[]> {
  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from("crews")
    .select("id, name")
    .order("name", { ascending: true });

  if (error) {
    console.error("fetchCrewOptions error:", error);
    return [];
  }

  return (data as CrewOption[]) ?? [];
}

async function fetchMemberOptions(): Promise<MemberOption[]> {
  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from("team_members")
    .select("id, first_name, last_name, email, status")
    .is("deleted_at", null)
    .eq("status", "active")
    .order("first_name", { ascending: true });

  if (error) {
    console.error("fetchMemberOptions error:", error);
    return [];
  }

  const rows = (data ?? []) as any[];

  return rows.map((row) => {
    const first = (row.first_name as string | null) ?? "";
    const last = (row.last_name as string | null) ?? "";
    const email = (row.email as string | null) ?? "";

    const namePart = [first, last].filter(Boolean).join(" ");
    const label = namePart || email || "Bez nazwy";

    return {
      id: String(row.id),
      label,
    };
  });
}

/* -------------------------------------------------------- */
/*                        PAGE JSX                          */
/* -------------------------------------------------------- */

type PageProps = {
  params: Promise<{ taskId: string }>;
};

export default async function TaskDetailsPage({ params }: PageProps) {
  const { taskId } = await params;

  const [task, crewOptions, memberOptions] = await Promise.all([
    fetchTask(taskId),
    fetchCrewOptions(),
    fetchMemberOptions(),
  ]);

  if (!task) {
    notFound();
  }

  return (
    <RoleGuard
      allow={["owner", "manager", "storeman", "worker"]}
      fallback={<div className="text-sm text-foreground/70">Brak dostępu.</div>}
    >
      <div className="space-y-6">
        {/* Ścieżka lokalizacji */}
        <div className="text-xs text-foreground/60">
          Lokalizacja:{" "}
          {task.placeChain.map((p, idx) => (
            <span key={p.id}>
              <Link
                href={`/object/${p.id}`}
                className="hover:underline text-foreground/80"
              >
                {p.name}
              </Link>
              {idx < task.placeChain.length - 1 && " / "}
            </span>
          ))}
        </div>

        {/* Nagłówek */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold">{task.title}</h1>

            {task.memberLabel && (
              <p className="text-xs text-foreground/70">
                Osoba: <strong>{task.memberLabel}</strong>
              </p>
            )}

            {task.crewName && (
              <p className="text-xs text-foreground/70">
                Brygada: <strong>{task.crewName}</strong>
              </p>
            )}

            {task.createdByLabel && (
              <p className="text-xs text-foreground/70">
                Zlecił: <strong>{task.createdByLabel}</strong>
              </p>
            )}
          </div>

          <div className="flex flex-col items-end">
            <TaskStatusBadge status={task.status} />
            <Link
              href="/tasks"
              className="text-[11px] mt-1 text-foreground/60 hover:underline"
            >
              &larr; Moje zadania
            </Link>
          </div>
        </div>

        {/* Opis */}
        <section>
          <h2 className="text-sm font-semibold text-foreground/80">Opis</h2>
          {task.description ? (
            <p className="text-sm whitespace-pre-line">{task.description}</p>
          ) : (
            <p className="text-sm text-foreground/60">Brak opisu.</p>
          )}
        </section>

        {/* Zdjęcia */}
        <section>
          <h2 className="text-sm font-semibold text-foreground/80">Zdjęcia</h2>
          <TaskPhotosLightbox
            photos={task.photos}
            taskId={task.id}
            deleteAction={deleteTaskPhoto}
          />
        </section>

        {/* Panel menedżera */}
        <RoleGuard allow={["owner", "manager"]}>
          <section className="border-t border-border/60 pt-4 space-y-4">
            <h2 className="text-sm font-semibold text-foreground/80">
              Panel menedżera
            </h2>

            <form action={updateTaskManager} className="space-y-3 max-w-md">
              <input type="hidden" name="task_id" value={task.id} />

              {/* Tytuł */}
              <div>
                <label className="block text-[11px] text-foreground/70">
                  Tytuł
                </label>
                <input
                  name="title"
                  defaultValue={task.title}
                  className="w-full bg-background border border-border rounded px-2 py-1 text-xs"
                />
              </div>

              {/* Opis */}
              <div>
                <label className="block text-[11px] text-foreground/70">
                  Opis
                </label>
                <textarea
                  name="description"
                  rows={3}
                  defaultValue={task.description ?? ""}
                  className="w-full bg-background border border-border rounded px-2 py-1 text-xs resize-none"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-[11px] text-foreground/70">
                  Status
                </label>
                <select
                  name="status"
                  defaultValue={task.status}
                  className="w-full bg-background border border-border rounded px-2 py-1 text-xs"
                >
                  <option value="todo">Do zrobienia</option>
                  <option value="in_progress">W trakcie</option>
                  <option value="done">Zrobione</option>
                </select>
              </div>

              {/* Brygada */}
              <div>
                <label className="block text-[11px] text-foreground/70">
                  Przypisana brygada
                </label>
                <select
                  name="assigned_crew_id"
                  defaultValue={task.crewId ?? ""}
                  className="w-full bg-background border border-border rounded px-2 py-1 text-xs"
                >
                  <option value="">— brak przypisania —</option>
                  {crewOptions.map((crew) => (
                    <option key={crew.id} value={crew.id}>
                      {crew.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Osoba */}
              <div>
                <label className="block text-[11px] text-foreground/70">
                  Przypisana osoba
                </label>
                <select
                  name="assigned_member_id"
                  defaultValue={task.memberId ?? ""}
                  className="w-full bg-background border border-border rounded px-2 py-1 text-xs"
                >
                  <option value="">— brak przypisania —</option>
                  {memberOptions.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <button className="bg-foreground text-background rounded px-3 py-1.5 text-xs font-semibold hover:bg-foreground/90">
                Zapisz zmiany
              </button>
            </form>

            {/* Soft delete zadania */}
            <form action={softDeleteTask} className="max-w-md">
              <input type="hidden" name="task_id" value={task.id} />
              <button
                type="submit"
                className="mt-2 w-full border border-red-500/70 text-red-400 rounded px-3 py-1.5 text-xs font-semibold hover:bg-red-500/10"
              >
                Usuń zadanie (soft delete)
              </button>
            </form>

            {/* Osobny uploader zdjęć */}
            <div className="max-w-md">
              <TaskPhotosUploader
                taskId={task.id}
                existingCount={task.photos.length}
              />
            </div>
          </section>
        </RoleGuard>
      </div>
    </RoleGuard>
  );
}
