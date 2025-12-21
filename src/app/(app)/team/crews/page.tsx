// src/app/(app)/team/crews/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";

import BackButton from "@/components/BackButton";
import {
  CrewsTable,
  type VCrewsOverview,
} from "./_components/CrewsTable";
import CreateCrewForm from "./_components/CreateCrewForm";
import type { VTeamMember } from "@/components/team/TeamMembersTable";

import { PERM, can, canAny, type PermissionSnapshot } from "@/lib/permissions";

// --------------------------------------------------------
//  PERMISSIONS SNAPSHOT (DB)
// --------------------------------------------------------
async function fetchMyPermissionsSnapshot(): Promise<PermissionSnapshot | null> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("my_permissions_snapshot");

  if (error) {
    console.error("my_permissions_snapshot error:", error);
    return null;
  }

  const snap = Array.isArray(data) ? (data[0] ?? null) : (data ?? null);
  return (snap as PermissionSnapshot | null) ?? null;
}

export default async function CrewsPage() {
  const supabase = await supabaseServer();
  const snapshot = await fetchMyPermissionsSnapshot();

  // wg ustaleń: worker+storeman też widzą listę i mogą wejść w szczegóły
  const canReadCrews = canAny(snapshot, [PERM.CREWS_READ, PERM.TEAM_READ]);
  if (!canReadCrews) notFound();

  // foreman/manager/owner mogą wszystko w brygadach
  const canManageCrews = can(snapshot, PERM.CREWS_MANAGE);

  // Brygady
  const { data: crewsData, error: crewsError } = await supabase
    .from("v_crews_overview")
    .select("*")
    .order("created_at", { ascending: true });

  // Członkowie zespołu – potrzebni do listy członków pod brygadą + dialogów
  const { data: membersData, error: membersError } = await supabase
    .from("v_team_members_view")
    .select("*")
    .order("created_at", { ascending: true });

  const crews = (crewsData ?? []) as VCrewsOverview[];
  const members = (membersData ?? []) as VTeamMember[];

  const hasError = crewsError || membersError;

  return (
    <section className="flex flex-col gap-4 md:gap-6">
      {/* Zakładki: Zespół / Brygady */}
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-2 rounded-2xl border border-border/70 bg-card/60 p-1 text-xs shadow-sm">
          <Link
            href="/team"
            className="rounded-xl px-3 py-1.5 text-[11px] font-medium tracking-wide text-muted-foreground hover:bg-muted/60"
          >
            Zespół
          </Link>
          <Link
            href="/team/crews"
            className="rounded-xl px-3 py-1.5 text-[11px] font-medium tracking-wide bg-primary text-primary-foreground"
          >
            Brygady
          </Link>
        </div>
      </div>

      {/* Nagłówek strony + backbutton (prawy górny róg) */}
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">
            Brygady
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Organizuj pracę na budowie w brygadach. Każda brygada może mieć przypisanego
            lidera oraz członków zespołu, co ułatwia rozliczanie zużycia materiałów i raportów dziennych.
          </p>
        </div>

        <div className="shrink-0 pt-0.5">
          <BackButton />
        </div>
      </header>

      {/* Pasek: podsumowanie */}
      <div className="rounded-2xl border border-border/70 bg-card/60 px-4 py-3 text-xs text-muted-foreground shadow-sm">
        {hasError ? (
          <div className="text-destructive">
            <div className="font-medium">
              Nie udało się pobrać danych o brygadach lub zespole.
            </div>
            <div className="text-[11px]">Sprawdź logi lub połączenie z bazą.</div>
          </div>
        ) : (
          <>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground/80">
              Podsumowanie
            </div>
            <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-6">
              <div className="flex items-center justify-between sm:justify-start sm:gap-2">
                <span>Łącznie brygad</span>
                <span className="font-medium text-foreground">{crews.length}</span>
              </div>
              <div className="flex items-center justify-between sm:justify-start sm:gap-2">
                <span>Członkowie zespołu</span>
                <span className="font-medium text-foreground">{members.length}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Widok listy brygad (header + członkowie) + global search + toggle “Stwórz brygadę” */}
      <CrewsTable crews={crews} members={members} canManage={canManageCrews} />
    </section>
  );
}
