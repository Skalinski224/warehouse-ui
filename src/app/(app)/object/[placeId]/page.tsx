import { notFound } from "next/navigation";
import Link from "next/link";

import { supabaseServer } from "@/lib/supabaseServer";
import RoleGuard from "@/components/RoleGuard";

import PlaceBreadcrumb, {
  type PlaceCrumb,
} from "@/components/object/PlaceBreadcrumb";
import PlaceChildrenList, {
  type ChildPlace,
} from "@/components/object/PlaceChildrenList";
import TaskList, {
  type TaskRow,
} from "@/components/object/TaskList";
import PlaceForm from "@/components/object/PlaceForm";
import TaskForm from "@/components/object/TaskForm";
import PlaceDeleteButton from "@/components/object/PlaceDeleteButton";

type PlaceRow = {
  id: string;
  name: string;
  description: string | null;
  parent_id: string | null;
};

type CrewOption = {
  id: string;
  name: string;
};

async function fetchPlace(placeId: string): Promise<PlaceRow | null> {
  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from("project_places")
    .select("id, name, description, parent_id")
    .eq("id", placeId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error("fetchPlace error:", error);
    return null;
  }

  return (data as PlaceRow) ?? null;
}

async function fetchChildren(placeId: string): Promise<ChildPlace[]> {
  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from("project_places")
    .select("id, name, description")
    .eq("parent_id", placeId)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error) {
    console.error("fetchChildren error:", error);
    return [];
  }

  return (data as ChildPlace[]) ?? [];
}

async function fetchTasks(placeId: string): Promise<TaskRow[]> {
  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from("project_tasks")
    .select("id, title, status, assigned_crew_id")
    .eq("place_id", placeId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("fetchTasks error:", error);
    return [];
  }

  return (data as TaskRow[]) ?? [];
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

  return (data as CrewOption[]) ?? [];
}

/**
 * Budujemy łańcuch breadcrumbów:
 * root → parent → current
 */
async function buildPlaceChain(current: PlaceRow): Promise<PlaceCrumb[]> {
  const supabase = await supabaseServer();

  const chain: PlaceRow[] = [];
  let cursor: PlaceRow | null = current;

  // Zbieramy rodziców "w górę"
  while (cursor?.parent_id) {
    const { data, error } = await supabase
      .from("project_places")
      .select("id, name, description, parent_id")
      .eq("id", cursor.parent_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      console.error("buildPlaceChain parent fetch error:", error);
      break;
    }
    if (!data) break;

    const parent = data as PlaceRow;
    chain.push(parent);
    cursor = parent;
  }

  const ordered: PlaceCrumb[] = [
    ...chain.reverse().map((p) => ({ id: p.id, name: p.name })),
    { id: current.id, name: current.name },
  ];

  return ordered;
}

type PageProps = {
  params: Promise<{
    placeId: string;
  }>;
};

export default async function PlacePage({ params }: PageProps) {
  const { placeId } = await params;

  const place = await fetchPlace(placeId);
  if (!place) {
    notFound();
  }

  const [children, tasks, chain, crewOptions] = await Promise.all([
    fetchChildren(place.id),
    fetchTasks(place.id),
    buildPlaceChain(place),
    fetchCrewOptions(),
  ]);

  return (
    <RoleGuard
      allow={["owner", "manager"]}
      fallback={
        <div className="text-sm text-foreground/70">
          Nie masz uprawnień do podglądu struktury obiektu.
        </div>
      }
    >
      <div className="space-y-6">
        {/* Główny header: breadcrumb + akcje */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <PlaceBreadcrumb chain={chain} />
            <h1 className="text-xl font-semibold">{place.name}</h1>
            {place.description && (
              <p className="text-sm text-foreground/70">
                {place.description}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Dodanie pod-miejsca */}
            <PlaceForm parentId={place.id} />
            {/* Dodanie zadania w tym miejscu */}
            <TaskForm placeId={place.id} crewOptions={crewOptions} />
            {/* Usunięcie (soft-delete) miejsca */}
            <PlaceDeleteButton
              placeId={place.id}
              parentId={place.parent_id}
            />
          </div>
        </div>

        {/* Pod-miejsca */}
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground/80">
              Pod-miejsca
            </h2>
            <Link
              href="/object"
              className="text-[11px] text-foreground/60 hover:text-foreground hover:underline"
            >
              &larr; Wszystkie miejsca
            </Link>
          </div>

          <PlaceChildrenList places={children} />
        </section>

        {/* Zadania w tym miejscu */}
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground/80">
            Zadania w tym miejscu
          </h2>
          <TaskList tasks={tasks} crewOptions={crewOptions} />
        </section>
      </div>
    </RoleGuard>
  );
}
