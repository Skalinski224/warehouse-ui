// src/app/(app)/tasks/page.tsx
import { supabaseServer } from "@/lib/supabaseServer";
import MyTasksTable, { type MyTaskRow } from "@/components/tasks/MyTasksTable";
import NewTaskForm from "@/components/tasks/NewTaskForm";
import { PERM, can, type PermissionSnapshot } from "@/lib/permissions";

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
/*              Snapshot permissions (DB source)            */
/* -------------------------------------------------------- */

async function fetchMyPermissionsSnapshot(): Promise<PermissionSnapshot | null> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("my_permissions_snapshot");

  if (error) {
    console.error("fetchMyPermissionsSnapshot error:", error);
    return null;
  }

  const snap = Array.isArray(data) ? (data[0] ?? null) : (data ?? null);
  return (snap as PermissionSnapshot | null) ?? null;
}

/* -------------------------------------------------------- */
/*                    Wspólne mapowanie                     */
/* -------------------------------------------------------- */

function getRelOne<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null;
  if (Array.isArray(rel)) return (rel[0] as T) ?? null;
  return rel as T;
}

function memberLabelFromRow(member: any): string | null {
  if (!member) return null;
  const f = (member.first_name as string | null) ?? "";
  const l = (member.last_name as string | null) ?? "";
  const e = (member.email as string | null) ?? "";
  const namePart = [f, l].filter(Boolean).join(" ");
  return namePart || e || null;
}

function mapTaskRowBase(row: any): MyTaskRow {
  const place = getRelOne<{ id: string; name: string | null }>(row.project_places);
  const crewRel = getRelOne<{ id: string; name: string | null }>(row.crews);
  const memberRel = getRelOne<{
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  }>(row.team_members);

  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    status: row.status as MyTaskRow["status"],
    placeId: row.place_id ? String(row.place_id) : null,
    placeName: place?.name ?? null,
    crewName: crewRel?.name ?? null,
    assigneeName: memberLabelFromRow(memberRel),
  };
}

/* -------------------------------------------------------- */
/*                    FETCH – READ ALL                      */
/* -------------------------------------------------------- */

async function fetchAllTasks(): Promise<MyTaskRow[]> {
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
    .neq("status", "done")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("fetchAllTasks error:", error);
    return [];
  }

  return (data ?? []).map(mapTaskRowBase);
}

/* -------------------------------------------------------- */
/*                    FETCH – READ OWN                      */
/* -------------------------------------------------------- */

async function fetchOwnTasks(userId: string): Promise<MyTaskRow[]> {
  const supabase = await supabaseServer();

  const { data: memberRows, error: memberError } = await supabase
    .from("team_members")
    .select("id, crew_id")
    .eq("user_id", userId)
    .is("deleted_at", null);

  if (memberError) {
    console.error("fetchOwnTasks team_members error:", memberError);
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

  if (crewIds.length > 0) {
    const { data: crewTasks, error: crewError } = await supabase
      .from("project_tasks")
      .select(selectClause)
      .in("assigned_crew_id", crewIds)
      .is("deleted_at", null)
      .neq("status", "done")
      .order("created_at", { ascending: true });

    if (crewError) console.error("fetchOwnTasks crew tasks error:", crewError);
    else if (crewTasks) rows.push(...crewTasks);
  }

  if (memberIds.length > 0) {
    const { data: memberTasks, error: memberTasksError } = await supabase
      .from("project_tasks")
      .select(selectClause)
      .in("assigned_member_id", memberIds)
      .is("deleted_at", null)
      .neq("status", "done")
      .order("created_at", { ascending: true });

    if (memberTasksError) console.error("fetchOwnTasks member tasks error:", memberTasksError);
    else if (memberTasks) rows.push(...memberTasks);
  }

  if (rows.length === 0) return [];

  const byId = new Map<string, any>();
  for (const row of rows) byId.set(String((row as any).id), row);

  return Array.from(byId.values()).map(mapTaskRowBase);
}

/* -------------------------------------------------------- */
/*                 FETCH – miejsca / brygady / osoby        */
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
  const { data, error } = await supabase.from("crews").select("id, name").order("name", {
    ascending: true,
  });

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

  return (data ?? []).map((row: any) => {
    const first = (row.first_name as string | null) ?? "";
    const last = (row.last_name as string | null) ?? "";
    const email = (row.email as string | null) ?? "";
    const namePart = [first, last].filter(Boolean).join(" ");
    const label = namePart || email || "Bez nazwy";
    return { id: String(row.id), label };
  });
}

/* -------------------------------------------------------- */
/*                          PAGE                            */
/* -------------------------------------------------------- */

export default async function MyTasksPage() {
  const supabase = await supabaseServer();

  const [{ data: auth, error: authError }, snapshot] = await Promise.all([
    supabase.auth.getUser(),
    fetchMyPermissionsSnapshot(),
  ]);

  if (authError) console.error("MyTasksPage getUser error:", authError);

  const user = auth?.user ?? null;

  const canReadAll = can(snapshot, PERM.TASKS_READ_ALL);
  const canReadOwn = can(snapshot, PERM.TASKS_READ_OWN);

  const isManager = canReadAll;

  let tasks: MyTaskRow[] = [];
  let placeOptions: PlaceOption[] = [];
  let crewOptions: CrewOption[] = [];
  let memberOptions: MemberOption[] = [];

  if (user) {
    if (canReadAll) {
      const [tasksRes, placesRes, crewsRes, membersRes] = await Promise.all([
        fetchAllTasks(),
        fetchPlaceOptions(),
        fetchCrewOptions(),
        fetchMemberOptions(),
      ]);

      tasks = tasksRes;
      placeOptions = placesRes;
      crewOptions = crewsRes;
      memberOptions = membersRes;
    } else if (canReadOwn) {
      tasks = await fetchOwnTasks(user.id);
    } else {
      tasks = [];
    }
  }

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Moje zadania</h1>
        <p className="text-sm text-foreground/70">
          {isManager
            ? "Przegląd wszystkich zadań w projekcie. Szukaj po tytule, miejscu lub przypisaniu."
            : "Lista zadań przypisanych do Ciebie lub Twojej brygady."}
        </p>
      </header>

      {isManager && (
        <NewTaskForm places={placeOptions} crewOptions={crewOptions} memberOptions={memberOptions} />
      )}

      <MyTasksTable tasks={tasks} isManager={isManager} />
    </div>
  );
}
