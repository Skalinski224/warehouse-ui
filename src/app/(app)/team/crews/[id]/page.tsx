// src/app/(app)/team/crews/[id]/page.tsx

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Crown } from "lucide-react";

import { supabaseServer } from "@/lib/supabaseServer";
import RoleGuard from "@/components/RoleGuard";

import AssignMemberDialog from "../_components/AssignMemberDialog";
import ChangeLeaderDialog from "../_components/ChangeLeaderDialog";
import type { VTeamMember } from "@/components/team/TeamMembersTable";
import type { VCrewsOverview } from "../_components/CrewsTable";

// --- typy pomocnicze z nowym backendem ---
type PageProps = {
  // w Next 15 params jest Promise
  params: Promise<{ id: string }>;
};

type Crew = VCrewsOverview & {
  description: string | null;
};

type Member = VTeamMember & {
  crew_id?: string | null;
};

// =======================
// Server actions
// =======================

async function updateCrewAction(formData: FormData) {
  "use server";

  const crewId = formData.get("crewId") as string;
  const name = (formData.get("name") as string | null) ?? "";
  const description = (formData.get("description") as string | null) ?? null;

  const supabase = await supabaseServer();

  const { error } = await supabase.rpc("update_crew", {
    p_crew_id: crewId,
    p_name: name,
    p_description: description,
  });

  if (error) {
    console.error("update_crew error", error);
    // w MVP tylko log – UI i tak się przeładuje
  }

  revalidatePath(`/team/crews/${crewId}`);
  revalidatePath("/team/crews");
}

async function deleteCrewAction(formData: FormData) {
  "use server";

  const crewId = formData.get("crewId") as string;

  const supabase = await supabaseServer();

  const { error } = await supabase.rpc("delete_crew", {
    p_crew_id: crewId,
  });

  if (error) {
    console.error("delete_crew error", error);
    // nie redirectujemy przy błędzie – ale logujemy
    return;
  }

  revalidatePath("/team/crews");
  redirect("/team/crews");
}

async function unassignMemberAction(formData: FormData) {
  "use server";

  const memberId = formData.get("memberId") as string;
  const crewId = formData.get("crewId") as string; // do revalidate

  const supabase = await supabaseServer();

  const { error } = await supabase.rpc("assign_member_to_crew", {
    p_member_id: memberId,
    p_crew_id: null,
  });

  if (error) {
    console.error("unassign member error", error);
  }

  revalidatePath(`/team/crews/${crewId}`);
  revalidatePath("/team/crews");
}

async function moveMemberAction(formData: FormData) {
  "use server";

  const memberId = formData.get("memberId") as string;
  const crewId = formData.get("crewId") as string; // aktualna brygada
  const targetCrewId = formData.get("targetCrewId") as string;

  const supabase = await supabaseServer();

  const { error } = await supabase.rpc("assign_member_to_crew", {
    p_member_id: memberId,
    p_crew_id: targetCrewId,
  });

  if (error) {
    console.error("move member error", error);
  }

  revalidatePath(`/team/crews/${crewId}`);
  revalidatePath("/team/crews");
}

// =======================
// Helpery
// =======================

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("pl-PL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

// =======================
// Page component
// =======================

export default async function CrewDetailPage(props: PageProps) {
  const { id } = await props.params;
  const crewId = id;

  const supabase = await supabaseServer();

  // 1) pobierz brygadę
  const { data: crewData, error: crewError } = await supabase
    .from("v_crews_overview")
    .select("*")
    .eq("id", crewId)
    .single();

  if (!crewData || crewError) {
    notFound();
  }

  const crew = crewData as Crew;

  // 2) pobierz wszystkie brygady (do szybkiego przepinania członków)
  const { data: allCrewsData } = await supabase
    .from("v_crews_overview")
    .select("*")
    .order("name", { ascending: true });

  const allCrews = (allCrewsData ?? []) as Crew[];
  const otherCrews = allCrews.filter((c) => c.id !== crew.id);

  // 3) pobierz wszystkich członków
  const { data: membersData, error: membersError } = await supabase
    .from("v_team_members_view")
    .select("*")
    .order("last_name", { ascending: true });

  if (membersError) {
    console.error("Error loading team members for crew detail:", membersError);
  }

  const allMembers = (membersData ?? []) as Member[];

  // członkowie przypisani do TEJ brygady – po crew_id
  const membersInThisCrew = allMembers.filter(
    (m) => m.crew_id === crew.id
  );

  const leaderName =
    [crew.leader_first_name, crew.leader_last_name]
      .filter(Boolean)
      .join(" ") || null;

  return (
    <RoleGuard allow={["owner", "manager"]}>
      <section className="flex flex-col gap-4 md:gap-6">
        {/* Breadcrumb */}
        <div className="text-xs text-muted-foreground">
          <Link href="/team/crews" className="hover:underline">
            Brygady
          </Link>{" "}
          /{" "}
          <span className="font-medium text-foreground">{crew.name}</span>
        </div>

        {/* Nagłówek + akcje główne */}
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">
              {crew.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              Utworzona: {formatDate(crew.created_at)} • Członków:{" "}
              <span className="font-medium text-foreground">
                {membersInThisCrew.length}
              </span>
              {leaderName && (
                <>
                  {" "}
                  • Lider:{" "}
                  <span className="inline-flex items-center gap-1 font-medium text-foreground">
                    <Crown className="h-3 w-3" />
                    {leaderName}
                  </span>
                </>
              )}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <AssignMemberDialog
              members={allMembers}
              crews={allCrews}
              defaultCrewId={crew.id}
              triggerLabel="Przypisz / zmień członków"
            />
            <ChangeLeaderDialog
              crew={crew}
              membersInCrew={membersInThisCrew}
              triggerLabel="Ustaw lidera"
            />

            {/* Usunięcie całej brygady */}
            <form action={deleteCrewAction}>
              <input type="hidden" name="crewId" value={crew.id} />
              <button
                type="submit"
                className="rounded-xl border border-destructive/60 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/15"
              >
                Usuń brygadę
              </button>
            </form>
          </div>
        </header>

        {/* Sekcja: szczegóły / edycja nazwy i opisu */}
        <div className="rounded-2xl border border-border/70 bg-card/60 px-4 py-3 shadow-sm md:px-6">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Szczegóły brygady
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Zmień nazwę i opis brygady. Zapis aktualizuje dane dla całego
            konta.
          </p>

          <form
            action={updateCrewAction}
            className="mt-3 flex flex-col gap-3 md:max-w-xl"
          >
            <input type="hidden" name="crewId" value={crew.id} />

            <div className="flex flex-col gap-1">
              <label
                htmlFor="name"
                className="text-xs font-medium text-muted-foreground"
              >
                Nazwa brygady
              </label>
              <input
                id="name"
                name="name"
                defaultValue={crew.name}
                required
                className="rounded-xl border border-border/70 bg-background/80 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/60"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="description"
                className="text-xs font-medium text-muted-foreground"
              >
                Opis brygady (opcjonalny)
              </label>
              <textarea
                id="description"
                name="description"
                defaultValue={crew.description ?? ""}
                rows={3}
                className="resize-none rounded-xl border border-border/70 bg-background/80 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/60"
                placeholder="Np. Ekipa elektryków, brygada nocna, prace wykończeniowe…"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="rounded-xl bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                Zapisz zmiany
              </button>
            </div>
          </form>
        </div>

        {/* Lista członków tej brygady */}
        <div className="rounded-2xl border border-border/70 bg-card/60 px-4 py-3 shadow-sm md:px-6">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Członkowie brygady
          </h2>

          {membersInThisCrew.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Ta brygada nie ma jeszcze przypisanych członków.
            </p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {membersInThisCrew.map((m) => {
                const isLeader =
                  crew.leader_member_id && m.id === crew.leader_member_id;

                return (
                  <li
                    key={m.id}
                    className="flex flex-col gap-2 rounded-xl border border-border/60 bg-background/40 px-3 py-2 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="flex items-center gap-2">
                      {isLeader && (
                        <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                          <Crown className="mr-1 h-3 w-3" />
                          Lider
                        </span>
                      )}
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">
                          {m.first_name} {m.last_name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {m.email} {m.phone ? `• ${m.phone}` : ""}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 md:justify-end">
                      {/* Usuń z brygady (wolny strzelec) */}
                      <form action={unassignMemberAction}>
                        <input type="hidden" name="memberId" value={m.id} />
                        <input type="hidden" name="crewId" value={crew.id} />
                        <button
                          type="submit"
                          className="rounded-xl border border-border/70 bg-background px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted/60"
                        >
                          Usuń z brygady
                        </button>
                      </form>

                      {/* Szybkie przeniesienie do innej brygady */}
                      {otherCrews.length > 0 && (
                        <form
                          action={moveMemberAction}
                          className="flex items-center gap-1"
                        >
                          <input
                            type="hidden"
                            name="memberId"
                            value={m.id}
                          />
                          <input type="hidden" name="crewId" value={crew.id} />
                          <select
                            name="targetCrewId"
                            className="max-w-[160px] rounded-xl border border-border/70 bg-background px-2 py-1 text-[11px]"
                            defaultValue=""
                            required
                          >
                            <option value="" disabled>
                              Przenieś do…
                            </option>
                            {otherCrews.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                          <button
                            type="submit"
                            className="rounded-xl bg-muted px-2 py-1 text-[11px] text-foreground hover:bg-muted/80"
                          >
                            OK
                          </button>
                        </form>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </RoleGuard>
  );
}
