// src/app/(app)/reports/stages/[taskId]/page.tsx

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { supabaseServer } from "@/lib/supabaseServer";
import RoleGuard from "@/components/RoleGuard";

import TaskDetails from "@/components/reports/stage/TaskDetails";
import TaskTimeline from "@/components/reports/stage/TaskTimeline";
import TaskPhotosGallery from "@/components/reports/stage/TaskPhotosGallery";

type TaskStatus = "todo" | "in_progress" | "done";

type ProjectPlaceRow = {
  id: string;
  name: string | null;
};

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  place_id: string | null;
  // ⬇️ UWAGA: Supabase zwraca TABLICĘ relacji, nie pojedynczy obiekt
  project_places: ProjectPlaceRow[] | null;
};

type TaskAttachmentRow = {
  id: string;
  url: string;
  created_at: string;
};

type TaskCompletionAttachmentRow = {
  id: string;
  url: string;
  created_at: string;
};

type TaskCompletionRow = {
  id: string;
  note: string | null;
  created_at: string;
  daily_report_id: string | null;
  completed_by_member_id: string | null;
  // ⬇️ też TABLICE, nie pojedyncze obiekty
  daily_reports: {
    id: string;
    date: string | null;
    crew_id: string | null;
  }[] | null;
  team_members: {
    id: string;
    first_name: string | null;
    last_name: string | null;
  }[] | null;
  task_completion_attachments: TaskCompletionAttachmentRow[] | null;
};

export const metadata: Metadata = {
  title: "Szczegóły zadania – Raport etapu",
};

async function fetchTask(taskId: string): Promise<TaskRow | null> {
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
      project_places (
        id,
        name
      )
    `
    )
    .eq("id", taskId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error("fetchTask error:", error);
    return null;
  }

  return (data as TaskRow) ?? null;
}

async function fetchTaskAttachments(taskId: string): Promise<TaskAttachmentRow[]> {
  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from("task_attachments")
    .select("id, url, created_at")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("fetchTaskAttachments error:", error);
    return [];
  }

  return (data as TaskAttachmentRow[]) ?? [];
}

async function fetchTaskCompletions(taskId: string): Promise<TaskCompletionRow[]> {
  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from("task_completions")
    .select(
      `
      id,
      note,
      created_at,
      daily_report_id,
      completed_by_member_id,
      daily_reports (
        id,
        date,
        crew_id
      ),
      team_members (
        id,
        first_name,
        last_name
      ),
      task_completion_attachments (
        id,
        url,
        created_at
      )
    `
    )
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("fetchTaskCompletions error:", error);
    return [];
  }

  return (data as TaskCompletionRow[]) ?? [];
}

export default async function TaskStageDetailsPage({
  params,
}: {
  params: { taskId: string };
}) {
  const taskId = params.taskId;

  const [task, attachments, completions] = await Promise.all([
    fetchTask(taskId),
    fetchTaskAttachments(taskId),
    fetchTaskCompletions(taskId),
  ]);

  if (!task) {
    notFound();
  }

  // ---- HEADER / MIEJSCE ----------------------------------------------------
  const primaryPlace: ProjectPlaceRow | null =
    task.project_places && task.project_places.length > 0
      ? task.project_places[0]
      : null;

  const placeName = primaryPlace?.name ?? "Brak miejsca";
  const placeId = primaryPlace?.id ?? task.place_id ?? null;

  const headerData = {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    place: placeId
      ? {
          id: placeId,
          name: placeName,
        }
      : null,
  };

  const attachmentsData = attachments.map((a) => ({
    id: a.id,
    url: a.url,
    createdAt: a.created_at,
  }));

  // ---- HISTORIA WYKONAŃ ----------------------------------------------------
  const completionsData = completions.map((c) => {
    const report = c.daily_reports && c.daily_reports.length > 0
      ? c.daily_reports[0]
      : null;
    const member = c.team_members && c.team_members.length > 0
      ? c.team_members[0]
      : null;

    return {
      id: c.id,
      note: c.note,
      createdAt: c.created_at,
      reportId: c.daily_report_id,
      reportDate: report?.date ?? null,
      crewId: report?.crew_id ?? null,
      memberId: member?.id ?? null,
      memberName: member
        ? `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim() || null
        : null,
      photosCount: c.task_completion_attachments?.length ?? 0,
    };
  });

  // ---- GALERIA ZDJĘĆ -------------------------------------------------------
  const photosData =
    completions.flatMap((c) =>
      (c.task_completion_attachments ?? []).map((p) => ({
        id: p.id,
        url: p.url,
        createdAt: p.created_at,
        createdByName: null as string | null, // jak będziemy mieli autora, tu podłączymy
      }))
    ) ?? [];

  return (
    <RoleGuard
      allow={["owner", "manager"]}
      fallback={
        <div className="p-6 text-sm text-foreground/70">
          Nie masz uprawnień do podglądu szczegółów zadań etapu.
        </div>
      }
    >
      <main className="p-6 space-y-8">
        {/* HEADER + MIEJSCE */}
        <TaskDetails task={headerData} attachments={attachmentsData} />

        {/* HISTORIA WYKONAŃ */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Historia wykonania</h2>
          <TaskTimeline completions={completionsData} />
        </section>

        {/* GALERIA ZDJĘĆ */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Zdjęcia z realizacji</h2>
          <TaskPhotosGallery photos={photosData} />
        </section>
      </main>
    </RoleGuard>
  );
}
