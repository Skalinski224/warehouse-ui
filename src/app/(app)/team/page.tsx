// src/app/(app)/team/page.tsx
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";

import { TeamTabs } from "@/components/team/TeamTabs";
import { TeamMembersTable, type VTeamMember } from "@/components/team/TeamMembersTable";

import InviteForm from "./_components/InviteForm";
import BackButton from "@/components/BackButton";

import { PERM, can, canAny, type PermissionSnapshot } from "@/lib/permissions";

// ✅ server actions PRZENIESIONE POZA PAGE
import {
  updateTeamMemberAction,
  deleteTeamMemberAction,
  resendInviteAction,
} from "./actions";

export const dynamic = "force-dynamic";

/* ------------------------------ HELPERS ------------------------------ */
function unwrapSnapshot(data: unknown): PermissionSnapshot | null {
  if (!data) return null;
  if (Array.isArray(data)) return (data[0] as PermissionSnapshot) ?? null;
  return data as PermissionSnapshot;
}

async function fetchMyPermissionsSnapshot(): Promise<PermissionSnapshot | null> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("my_permissions_snapshot");
  if (error) {
    console.error("my_permissions_snapshot error:", error);
    return null;
  }
  return unwrapSnapshot(data);
}

/* ------------------------------- PAGE ------------------------------- */
export default async function TeamPage() {
  const supabase = await supabaseServer();
  const snapshot = await fetchMyPermissionsSnapshot();

  // Każdy kto ma w ogóle podgląd zespołu może wejść
  const canReadTeam = canAny(snapshot, [PERM.TEAM_READ, PERM.TEAM_MEMBER_READ]);
  if (!canReadTeam) notFound();

  // Permissions wg matrycy
  const canInvite = can(snapshot, PERM.TEAM_INVITE);
  const canRemove = can(snapshot, PERM.TEAM_REMOVE);

  const canChangeCrew = can(snapshot, PERM.TEAM_MANAGE_CREWS); // foreman + owner/manager
  const canChangeRole = can(snapshot, PERM.TEAM_MANAGE_ROLES); // owner/manager
  const canEditDetails = can(snapshot, PERM.TEAM_MANAGE_ROLES); // owner/manager

  // worker/storeman: nie mogą wejść w szczegóły członka
  const canOpenDetails =
    can(snapshot, PERM.TEAM_MANAGE_CREWS) ||
    can(snapshot, PERM.TEAM_MANAGE_ROLES) ||
    can(snapshot, PERM.TEAM_INVITE) ||
    can(snapshot, PERM.TEAM_REMOVE) ||
    can(snapshot, PERM.TEAM_MEMBER_FORCE_RESET);

  const { data, error } = await supabase
    .from("v_team_members_view")
    .select("*")
    .order("created_at", { ascending: true });

  const members = (data ?? []) as VTeamMember[];

  // ⚠️ ważne: to nadal te same akcje, tylko importowane z ./actions
  const onEdit = canChangeCrew || canEditDetails ? updateTeamMemberAction : undefined;
  const onDelete = canRemove ? deleteTeamMemberAction : undefined;
  const onResendInvite = canInvite ? resendInviteAction : undefined;

  return (
    <section className="space-y-4">
      <TeamTabs />

      {/* HEADER (KANON) */}
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-sm font-medium">Zespół</h1>
          <p className="text-xs opacity-70">
            Zarządzaj członkami zespołu przypisanymi do tego konta. Zaproszenia, role, brygady.
          </p>
        </div>

        <div className="shrink-0">
          <BackButton />
        </div>
      </header>

      {/* PODSUMOWANIE + AKCJE */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="rounded-2xl border border-border bg-card p-4">
          {error ? (
            <div className="text-sm text-foreground/80">
              <div className="font-medium">Nie udało się pobrać listy zespołu.</div>
              <div className="text-xs opacity-70 mt-1">Sprawdź logi i uprawnienia widoku.</div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-xs opacity-70">Podsumowanie</div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span>Łącznie członków</span>
                <span className="font-semibold">{members.length}</span>
              </div>
              <div className="text-[11px] opacity-70">
                Dostęp:{" "}
                <span className="font-medium">{canInvite ? "zapraszanie" : "bez zapraszania"}</span>,{" "}
                <span className="font-medium">
                  {canChangeCrew ? "zmiana brygad" : "bez zmiany brygad"}
                </span>,{" "}
                <span className="font-medium">{canChangeRole ? "zmiana ról" : "bez zmiany ról"}</span>
              </div>
            </div>
          )}
        </div>

        {/* InviteForm sam robi modal; renderujemy tylko jeśli ma perm */}
        <div className="flex items-center justify-end gap-2">{canInvite ? <InviteForm /> : null}</div>
      </div>

      {/* TABELA */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="border-b border-border/70 px-4 py-3">
          <div className="text-sm font-medium">Członkowie</div>
          <div className="text-xs opacity-70">
            Lista jest wspólna dla konta. Klik w szczegóły działa tylko dla osób z uprawnieniami.
          </div>
        </div>

        <div className="p-3">
          <TeamMembersTable
            members={members}
            onEdit={onEdit}
            onDelete={onDelete}
            onResendInvite={onResendInvite}
            canOpenDetails={canOpenDetails}
            canChangeCrew={canChangeCrew}
            canChangeRole={canChangeRole}
            canEditDetails={canEditDetails}
          />
        </div>
      </div>
    </section>
  );
}
