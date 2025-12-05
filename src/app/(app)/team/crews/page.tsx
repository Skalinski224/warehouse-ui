// src/app/(app)/team/crews/page.tsx

import Link from "next/link";
import { supabaseServer } from "@/lib/supabaseServer";
import RoleGuard from "@/components/RoleGuard";

import {
  CrewsTable,
  type VCrewsOverview,
} from "./_components/CrewsTable";
import CreateCrewForm from "./_components/CreateCrewForm";
import type { VTeamMember } from "@/components/team/TeamMembersTable";

export default async function CrewsPage() {
  const supabase = await supabaseServer();

  // Brygady
  const { data: crewsData, error: crewsError } = await supabase
    .from("v_crews_overview")
    .select("*")
    .order("created_at", { ascending: true });

  // Członkowie zespołu – potrzebni do AssignMemberDialog / ChangeLeaderDialog
  const { data: membersData, error: membersError } = await supabase
    .from("v_team_members_view")
    .select("*")
    .order("created_at", { ascending: true });

  const crews = (crewsData ?? []) as VCrewsOverview[];
  const members = (membersData ?? []) as VTeamMember[];

  const hasError = crewsError || membersError;

  return (
    // Ten moduł: tylko owner + manager
    <RoleGuard allow={["owner", "manager"]}>
      <section className="flex flex-col gap-4 md:gap-6">
        {/* Zakładki: Zespół / Brygady */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-2xl border border-border/70 bg-card/60 p-1 text-xs shadow-sm">
            <Link
              href="/team"
              className="rounded-xl px-3 py-1.5 text-[11px] font-medium tracking-wide
                         text-muted-foreground hover:bg-muted/60"
            >
              Zespół
            </Link>
            <Link
              href="/team/crews"
              className="rounded-xl px-3 py-1.5 text-[11px] font-medium tracking-wide
                         bg-primary text-primary-foreground"
            >
              Brygady
            </Link>
          </div>
        </div>

        {/* Nagłówek strony */}
        <header className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">
            Brygady
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Organizuj pracę na budowie w brygadach. Każda brygada może mieć
            przypisanego lidera oraz członków zespołu, co ułatwia rozliczanie
            zużycia materiałów i raportów dziennych.
          </p>
        </header>

        {/* Pasek: podsumowanie + formularz tworzenia brygady */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="rounded-2xl border border-border/70 bg-card/60 px-4 py-3 text-xs text-muted-foreground shadow-sm md:min-w-[220px]">
            {hasError ? (
              <div className="text-destructive">
                <div className="font-medium">
                  Nie udało się pobrać danych o brygadach lub zespole.
                </div>
                <div className="text-[11px]">
                  Sprawdź logi lub połączenie z bazą.
                </div>
              </div>
            ) : (
              <>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground/80">
                  Podsumowanie
                </div>
                <div className="mt-1 flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span>Łącznie brygad</span>
                    <span className="font-medium text-foreground">
                      {crews.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Członkowie zespołu</span>
                    <span className="font-medium text-foreground">
                      {members.length}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Formularz dodawania brygady */}
          <CreateCrewForm />
        </div>

        {/* Tabela brygad + akcje na nich */}
        <CrewsTable crews={crews} members={members} />
      </section>
    </RoleGuard>
  );
}
