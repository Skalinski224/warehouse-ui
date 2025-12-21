// src/app/(app)/object/[placeId]/page.tsx
import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import { supabaseServer } from "@/lib/supabaseServer";
import type { PermissionSnapshot } from "@/lib/permissions";

import BackButton from "@/components/BackButton";

import PlaceBreadcrumb, { type PlaceCrumb } from "@/components/object/PlaceBreadcrumb";
import PlaceChildrenList, { type ChildPlace } from "@/components/object/PlaceChildrenList";
import TaskList, { type TaskRow } from "@/components/object/TaskList";
import PlaceForm from "@/components/object/PlaceForm";
import TaskForm from "@/components/object/TaskForm";
import PlaceDeleteButton from "@/components/object/PlaceDeleteButton";

export const dynamic = "force-dynamic";

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

type MemberOption = {
  id: string;
  full_name: string;
};

function unwrapSnapshot(data: unknown): PermissionSnapshot | null {
  if (!data) return null;
  if (Array.isArray(data)) return (data[0] as PermissionSnapshot) ?? null;
  return data as PermissionSnapshot;
}

function normStatus(v: unknown) {
  return String(v ?? "").trim().toLowerCase();
}

function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "ok" | "warn";
}) {
  const cls =
    tone === "ok"
      ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-300"
      : tone === "warn"
      ? "border-amber-500/35 bg-amber-500/10 text-amber-300"
      : "border-border bg-background/60 text-foreground/80";

  return (
    <span className={`inline-flex items-center rounded px-2 py-1 text-[11px] border ${cls}`}>
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  FETCHES                                   */
/* -------------------------------------------------------------------------- */

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

  const { data, error } = await supabase.from("crews").select("id, name").order("name", {
    ascending: true,
  });

  if (error) {
    console.error("fetchCrewOptions error:", error);
    return [];
  }

  return (data as CrewOption[]) ?? [];
}

/**
 * Pobieramy osoby z v_account_members_overview bez zakładania kolumn.
 * - select("*") żeby nie wywaliło na brak kolumn
 * - sort w JS
 */
async function fetchMemberOptions(): Promise<MemberOption[]> {
  const supabase = await supabaseServer();

  const { data, error } = await supabase.from("v_account_members_overview").select("*");
  if (error) {
    console.error("fetchMemberOptions error:", error);
    return [];
  }

  const rows = (data as any[]) ?? [];
  if (rows.length === 0) return [];

  const preferredIdKeys = [
    "team_member_id",
    "member_id",
    "team_member_uuid",
    "member_uuid",
    "user_id",
    "id",
  ];

  function pickIdKey(r: any): string | null {
    for (const k of preferredIdKeys) {
      if (r && r[k] != null) return k;
    }
    const auto = Object.keys(r ?? {}).find((k) => k.endsWith("_id") || k.endsWith("_uuid"));
    return auto ?? null;
  }

  function pickName(r: any): { first: string; last: string; email: string } {
    const first = String(r.first_name ?? r.firstname ?? r.given_name ?? r.name_first ?? "").trim();
    const last = String(r.last_name ?? r.lastname ?? r.family_name ?? r.name_last ?? "").trim();
    const email = String(r.email ?? r.mail ?? "").trim();
    return { first, last, email };
  }

  const mapped: MemberOption[] = rows
    .map((r) => {
      const idKey = pickIdKey(r);
      const rawId = idKey ? r[idKey] : null;
      if (!rawId) return null;

      const { first, last, email } = pickName(r);
      const full = [first, last].filter(Boolean).join(" ") || email || String(rawId);

      return { id: String(rawId), full_name: full } satisfies MemberOption;
    })
    .filter(Boolean) as MemberOption[];

  mapped.sort((a, b) => a.full_name.localeCompare(b.full_name, "pl", { sensitivity: "base" }));
  return mapped;
}

/* -------------------------------------------------------------------------- */
/*                             BREADCRUMB CHAIN                               */
/* -------------------------------------------------------------------------- */

async function buildPlaceChain(current: PlaceRow): Promise<PlaceCrumb[]> {
  const supabase = await supabaseServer();

  const chain: PlaceRow[] = [];
  let cursor: PlaceRow | null = current;

  while (cursor?.parent_id) {
    const { data, error } = await supabase
      .from("project_places")
      .select("id, name, description, parent_id")
      .eq("id", cursor.parent_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error || !data) break;

    const parent = data as PlaceRow;
    chain.push(parent);
    cursor = parent;
  }

  return [
    ...chain.reverse().map((p) => ({ id: p.id, name: p.name })),
    { id: current.id, name: current.name },
  ];
}

/* -------------------------------------------------------------------------- */
/*                                   PAGE                                     */
/* -------------------------------------------------------------------------- */

type PageProps = {
  params: Promise<{ placeId: string }>;
};

export default async function PlacePage({ params }: PageProps) {
  const supabase = await supabaseServer();

  const { data, error } = await supabase.rpc("my_permissions_snapshot");
  const snapshot = unwrapSnapshot(data);

  if (!snapshot || error) redirect("/");

  // TEMP gating po roli (dopóki nie podepniesz PERM.OBJECT_*):
  if (snapshot.role === "worker" || snapshot.role === "storeman") redirect("/");

  const { placeId } = await params;

  const place = await fetchPlace(placeId);
  if (!place) notFound();

  const [children, tasks, chain, crewOptions, memberOptions] = await Promise.all([
    fetchChildren(place.id),
    fetchTasks(place.id),
    buildPlaceChain(place),
    fetchCrewOptions(),
    fetchMemberOptions(),
  ]);

  const doneTasks = tasks.filter((t) => normStatus((t as any).status) === "done");
  const inProgressTasks = tasks.filter((t) => normStatus((t as any).status) !== "done");

  const totalChildren = children.length;
  const totalTasks = tasks.length;

  return (
    <main className="space-y-4">
      {/* HEADER (KANON) */}
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="text-sm font-medium">Obiekt</div>
          <PlaceBreadcrumb chain={chain} />
          <h1 className="text-xl font-semibold md:text-2xl truncate">{place.name}</h1>
          {place.description ? (
            <p className="text-xs opacity-70 line-clamp-2">{place.description}</p>
          ) : (
            <p className="text-xs opacity-70">Widok miejsca: pod-miejsca + zadania.</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Pill tone="neutral">
            Podmiejsc: <span className="font-semibold ml-1">{totalChildren}</span>
          </Pill>
          <Pill tone="neutral">
            Zadań: <span className="font-semibold ml-1">{totalTasks}</span>
          </Pill>
          <BackButton className="inline-flex items-center justify-center rounded-xl border border-border bg-background px-3 py-2 text-xs hover:bg-foreground/5 transition" />
        </div>
      </header>

      {/* TOOLBAR (akcje w jednym miejscu) */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="text-sm font-medium">Akcje</div>
            <div className="text-xs opacity-70">
              Dodaj pod-miejsce lub zadanie w tym miejscu. Usuwanie miejsca przenosi Cię poziom wyżej.
            </div>
            <div className="mt-2">
              <Link
                href="/object"
                className="text-[11px] opacity-70 hover:opacity-100 hover:underline"
              >
                ← Wszystkie miejsca
              </Link>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <PlaceForm parentId={place.id} />
            <TaskForm placeId={place.id} crewOptions={crewOptions} memberOptions={memberOptions} />
            <PlaceDeleteButton placeId={place.id} parentId={place.parent_id} />
          </div>
        </div>
      </section>

      {/* POD-MIEJSCA */}
      <section className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="border-b border-border/70 px-4 py-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">Pod-miejsca</h2>
            <p className="text-xs opacity-70">Struktura “w dół” w ramach tego miejsca.</p>
          </div>
          <Pill tone={totalChildren === 0 ? "warn" : "ok"}>
            {totalChildren === 0 ? "Brak" : "OK"}
          </Pill>
        </div>

        <div className="p-4">
          <PlaceChildrenList places={children} />
        </div>
      </section>

      {/* ZADANIA W TOKU */}
      <section className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="border-b border-border/70 px-4 py-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">Zadania w toku</h2>
            <p className="text-xs opacity-70">Wszystko poza “done”.</p>
          </div>
          <Pill tone={inProgressTasks.length === 0 ? "neutral" : "warn"}>
            {inProgressTasks.length} szt.
          </Pill>
        </div>

        <div className="p-4">
          <TaskList tasks={inProgressTasks} crewOptions={crewOptions} />
        </div>
      </section>

      {/* ZADANIA ZAKOŃCZONE */}
      <section className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="border-b border-border/70 px-4 py-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">Zadania skończone</h2>
            <p className="text-xs opacity-70">Status “done”.</p>
          </div>
          <Pill tone={doneTasks.length === 0 ? "neutral" : "ok"}>{doneTasks.length} szt.</Pill>
        </div>

        <div className="p-4">
          <TaskList tasks={doneTasks} crewOptions={crewOptions} />
        </div>
      </section>
    </main>
  );
}
