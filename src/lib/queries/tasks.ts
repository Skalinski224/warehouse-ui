// src/lib/queries/tasks.ts
import { supabaseServer } from "@/lib/supabaseServer";
import type { TaskOption } from "@/lib/dto";

type FetchTasksArgs = {
  crewId?: string | null;
  memberId?: string | null;
};

/**
 * Pobiera zadania przypisane do podanej brygady i/lub konkretnego członka.
 * Używane przy tworzeniu raportu dziennego.
 *
 * UWAGA: Zwracamy tylko zadania AKTYWNE:
 *   status IN ('todo', 'in_progress')
 */
export async function fetchTasksForCrewOrMember(
  { crewId, memberId }: FetchTasksArgs
): Promise<TaskOption[]> {
  const supabase = await supabaseServer();

  let query = supabase
    .from("project_tasks")
    .select(
      `
      id,
      title,
      place_id,
      assigned_crew_id,
      assigned_member_id,
      project_places ( name )
    `
    )
    // tylko zadania nie zakończone
    .in("status", ["todo", "in_progress"])
    .is("deleted_at", null);

  if (crewId && memberId) {
    // zadania przypisane do tej brygady LUB tego członka
    query = query.or(
      `assigned_crew_id.eq.${crewId},assigned_member_id.eq.${memberId}`
    );
  } else if (crewId) {
    query = query.eq("assigned_crew_id", crewId);
  } else if (memberId) {
    query = query.eq("assigned_member_id", memberId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[fetchTasksForCrewOrMember] error:", error);
    return [];
  }

  return (
    data?.map((t: any) => ({
      id: t.id as string,
      title: (t.title ?? "") as string,
      placeId: (t.place_id ?? null) as string | null,
      placeName: (t.project_places?.name ?? null) as string | null,
      assignedCrewId: (t.assigned_crew_id ?? null) as string | null,
      assignedMemberId: (t.assigned_member_id ?? null) as string | null,
    })) ?? []
  );
}
