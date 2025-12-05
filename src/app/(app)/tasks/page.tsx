import { supabaseServer } from "@/lib/supabaseServer";
import { getCurrentRole } from "@/lib/getCurrentRole";
import MyTasksTable, {
  type MyTaskRow,
} from "@/components/tasks/MyTasksTable";
import NewTaskForm from "@/components/tasks/NewTaskForm";

/* -------------------------------------------------------- */
/*                    Typy pomocnicze                       */
/* -------------------------------------------------------- */

type PlaceOption = {
  id: string;
  name: string;
};

type CrewOption = {
  id: string;
  name: string;
};

type MemberOption = {
  id: string;
  label: string;
};

/* -------------------------------------------------------- */
/*                    Wspólne mapowanie                     */
/* -------------------------------------------------------- */

function mapTaskRowBase(row: any): MyTaskRow {
  const place = row.project_places as
    | { id: string; name: string | null }
    | null
    | undefined;

  const crewsRel = row.crews as
    | { id: string; name: string | null }
    | { id: string; name: string | null }[]
    | null
    | undefined;

  let crewName: string | null = null;
  if (Array.isArray(crewsRel)) {
    if (crewsRel.length > 0) crewName = crewsRel[0]?.name ?? null;
  } else if (crewsRel) {
    crewName = crewsRel.name ?? null;
  }

  // Może być niezaładowane (worker nie robi JOIN na team_members)
  const memberRel = row.team_members as
    | { id: string; first_name: string | null; last_name: string | null; email: string | null }
    | null
    | undefined;

  let assigneeName: string | null = null;
  if (memberRel) {
    const f = (memberRel.first_name as string | null) ?? "";
    const l = (memberRel.last_name as string | null) ?? "";
    const e = (memberRel.email as string | null) ?? "";
    const namePart = [f, l].filter(Boolean).join(" ");
    assigneeName = namePart || e || null;
  }

  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    status: row.status as MyTaskRow["status"],
    placeId: row.place_id ? String(row.place_id) : null,
    placeName: place?.name ?? null,
    crewName,
    assigneeName,
  };
}

/* -------------------------------------------------------- */
/*                    FETCH – MANAGER / OWNER               */
/* -------------------------------------------------------- */

async function fetchManagerTasks(): Promise<MyTaskRow[]> {
  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from("project_tasks")
    .select(
      `
        id,
        title,
        status,
        place_id,
        assigned_crew_id,
        assigned_member_id,
        project_places (
          id,
          name
        ),
        crews (
          id,
          name
        ),
        team_members (
          id,
          first_name,
          last_name,
          email
        )
      `
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("fetchManagerTasks error:", error);
    return [];
  }

  const rows = (data ?? []) as any[];
  return rows.map(mapTaskRowBase);
}

/* -------------------------------------------------------- */
/*                      FETCH – WORKER                      */
/*   (zadania przypisane do brygad i/lub konkretnej osoby)  */
/* -------------------------------------------------------- */

async function fetchWorkerTasks(userId: string): Promise<MyTaskRow[]> {
  const supabase = await supabaseServer();

  // 1) członkostwo użytkownika
  const { data: memberRows, error: memberError } = await supabase
    .from("team_members")
    .select("id, crew_id")
    .eq("user_id", userId)
    .is("deleted_at", null);

  if (memberError) {
    console.error("fetchWorkerTasks team_members error:", memberError);
    return [];
  }

  const memberIds = (memberRows ?? [])
    .map((m: any) => m.id as string | null)
    .filter((id): id is string => !!id);

  const crewIds = (memberRows ?? [])
    .map((m: any) => m.crew_id as string | null)
    .filter((id): id is string => !!id);

  const selectClause = `
    id,
    title,
    status,
    place_id,
    assigned_crew_id,
    assigned_member_id,
    project_places (
      id,
      name
    ),
    crews (
      id,
      name
    )
  `;

  const rows: any[] = [];

  // 2a) zadania przypisane do brygad użytkownika
  if (crewIds.length > 0) {
    const { data: crewTasks, error: crewError } = await supabase
      .from("project_tasks")
      .select(selectClause)
      .in("assigned_crew_id", crewIds)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (crewError) {
      console.error("fetchWorkerTasks crew tasks error:", crewError);
    } else if (crewTasks) {
      rows.push(...crewTasks);
    }
  }

  // 2b) zadania przypisane konkretnie do tej osoby
  if (memberIds.length > 0) {
    const { data: memberTasks, error: memberTasksError } = await supabase
      .from("project_tasks")
      .select(selectClause)
      .in("assigned_member_id", memberIds)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (memberTasksError) {
      console.error("fetchWorkerTasks member tasks error:", memberTasksError);
    } else if (memberTasks) {
      rows.push(...memberTasks);
    }
  }

  if (rows.length === 0) {
    return [];
  }

  // 3) deduplikacja po id (jeśli zadanie jest i na brygadę, i na osobę)
  const byId = new Map<string, any>();
  for (const row of rows) {
    byId.set(String((row as any).id), row);
  }

  return Array.from(byId.values()).map(mapTaskRowBase);
}

/* -------------------------------------------------------- */
/*                 FETCH – miejsca / brygady / osoby        */
/*                 (używane tylko przez managera)           */
/* -------------------------------------------------------- */

async function fetchPlaceOptions(): Promise<PlaceOption[]> {
  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from("project_places")
    .select("id, name")
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error) {
    console.error("fetchPlaceOptions error:", error);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    name: String(row.name ?? ""),
  }));
}

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

  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    name: String(row.name ?? ""),
  }));
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
/*                          PAGE                            */
/* -------------------------------------------------------- */

export default async function MyTasksPage() {
  const supabase = await supabaseServer();
  const { data: auth, error: authError } = await supabase.auth.getUser();

  if (authError) {
    console.error("MyTasksPage getUser error:", authError);
  }

  const user = auth?.user ?? null;

  const role = await getCurrentRole();
  const isManager = role === "owner" || role === "manager";

  let tasks: MyTaskRow[] = [];
  let placeOptions: PlaceOption[] = [];
  let crewOptions: CrewOption[] = [];
  let memberOptions: MemberOption[] = [];

  if (user) {
    if (isManager) {
      const [tasksRes, placesRes, crewsRes, membersRes] = await Promise.all([
        fetchManagerTasks(),
        fetchPlaceOptions(),
        fetchCrewOptions(),
        fetchMemberOptions(),
      ]);

      tasks = tasksRes;
      placeOptions = placesRes;
      crewOptions = crewsRes;
      memberOptions = membersRes;
    } else {
      tasks = await fetchWorkerTasks(user.id);
    }
  }

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Moje zadania</h1>
        <p className="text-sm text-foreground/70">
          {isManager
            ? "Przegląd wszystkich zadań w projekcie. Użyj wyszukiwarki, żeby znaleźć zadanie po tytule, miejscu lub przypisanej osobie/brygadzie."
            : "Lista zadań przypisanych do Ciebie lub Twojej brygady."}
        </p>
      </header>

      {isManager && (
        <NewTaskForm
          places={placeOptions}
          crewOptions={crewOptions}
          memberOptions={memberOptions}
        />
      )}

      <MyTasksTable tasks={tasks} isManager={isManager} />
    </div>
  );
}
