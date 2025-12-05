// src/app/(app)/daily-reports/page.tsx
import DailyReportForm from "./_components/DailyReportForm";
import { supabaseServer } from "@/lib/supabaseServer";

type TaskStatus = "todo" | "in_progress" | "done";

export type TaskForCrew = {
  id: string;
  title: string;
  status: TaskStatus;
  placeId: string;
  placeName: string | null;
};

export default async function DailyReportsPage() {
  // supabaseServer jest async → używamy await
  const supabase = await supabaseServer();

  async function fetchMaterials() {
    const { data, error } = await supabase
      .from("materials")
      .select("id, title, unit")
      .order("title", { ascending: true })
      .limit(300);

    if (error) {
      console.error("❌ fetchMaterials error:", error);
      return [];
    }

    const rows =
      (data ?? []) as { id: string; title: string; unit: string | null }[];

    // Dopasowanie do typu oczekiwanego przez DailyReportForm: { id, name, unit }
    return rows.map((row) => ({
      id: row.id,
      name: row.title,
      unit: row.unit,
    }));
  }

  async function fetchCurrentMemberAndCrew() {
    // 1. Bieżący user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error("❌ getUser error:", userError);
      return { memberId: null, crewId: null };
    }

    if (!user) {
      return { memberId: null, crewId: null };
    }

    // 2. Członek zespołu powiązany z tym userem (w ramach bieżącego account_id przez RLS)
    const { data: member, error: memberError } = await supabase
      .from("team_members")
      .select("id, crew_id")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (memberError) {
      console.error("❌ fetchCurrentMemberAndCrew error:", memberError);
      return { memberId: null, crewId: null };
    }

    if (!member) {
      return { memberId: null, crewId: null };
    }

    return {
      memberId: member.id as string,
      crewId: (member.crew_id as string | null) ?? null,
    };
  }

  async function fetchTasksForCrew(
    crewId: string | null
  ): Promise<TaskForCrew[]> {
    if (!crewId) return [];

    const { data, error } = await supabase
      .from("project_tasks")
      .select(
        `
        id,
        title,
        status,
        place_id,
        project_places (
          name
        )
      `
      )
      .eq("assigned_crew_id", crewId)
      .in("status", ["todo", "in_progress"])
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("❌ fetchTasksForCrew error:", error);
      return [];
    }

    const rows =
      (data as {
        id: string;
        title: string;
        status: TaskStatus;
        place_id: string;
        project_places?: { name: string | null }[] | null;
      }[]) ?? [];

    return rows.map((row) => {
      let placeName: string | null = null;

      if (Array.isArray(row.project_places) && row.project_places.length > 0) {
        placeName = row.project_places[0]?.name ?? null;
      }

      return {
        id: row.id,
        title: row.title,
        status: row.status,
        placeId: row.place_id,
        placeName,
      };
    });
  }

  const [materials, { memberId, crewId }] = await Promise.all([
    fetchMaterials(),
    fetchCurrentMemberAndCrew(),
  ]);

  const tasksForCrew = await fetchTasksForCrew(crewId);

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Dzienne zużycie — nowy raport</h1>

      <DailyReportForm
        materials={materials}
        currentMemberId={memberId}
        currentCrewId={crewId}
        tasksForCrew={tasksForCrew}
      />
    </main>
  );
}
