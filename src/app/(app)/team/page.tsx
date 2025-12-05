// src/app/(app)/team/page.tsx

import Link from "next/link";
import { supabaseServer } from "@/lib/supabaseServer";
import RoleGuard from "@/components/RoleGuard";

import { TeamTabs } from "@/components/team/TeamTabs";
import {
  TeamMembersTable,
  type VTeamMember,
} from "@/components/team/TeamMembersTable";
import InviteForm from "./_components/InviteForm";

// --------------------------------------------------------
//  SERVER ACTIONS: CRUD NA CZŁONKACH ZESPOŁU
// --------------------------------------------------------
export async function updateTeamMemberAction(form: {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  // UWAGA: account_role olewamy na razie – backend do ról nie jest gotowy
  account_role?: string | null;
  crew_id?: string | null;
}) {
  "use server";

  const supabase = await supabaseServer(); // ⬅⬅ DODANY await

  // Budujemy obiekt update tylko z tym, co faktycznie zmieniamy
  const update: Record<string, any> = {};

  if ("first_name" in form) update.first_name = form.first_name;
  if ("last_name" in form) update.last_name = form.last_name;
  if ("email" in form) update.email = form.email;
  if ("phone" in form) update.phone = form.phone;
  if ("crew_id" in form) update.crew_id = form.crew_id;

  // Jeśli nic do zmiany – wychodzimy
  if (Object.keys(update).length === 0) {
    return;
  }

  const { error } = await supabase
    .from("team_members")
    .update(update)
    .eq("id", form.id);

  if (error) {
    console.error("❌ team_members update error:", error);
    throw new Error("Nie udało się zaktualizować danych użytkownika.");
  }
}

export async function deleteTeamMemberAction(id: string) {
  "use server";

  const supabase = await supabaseServer(); // ⬅⬅ DODANY await

  const { error } = await supabase.rpc("delete_team_member", {
    p_member_id: id,
  });

  if (error) {
    console.error("❌ delete_team_member error:", error);
    throw new Error("Nie udało się usunąć członka zespołu.");
  }
}

export async function resendInviteAction(id: string) {
  "use server";

  const supabase = await supabaseServer(); // ⬅⬅ DODANY await

  const { data, error } = await supabase.rpc("rotate_invite_token", {
    p_member_id: id,
  });

  if (error) {
    console.error("❌ rotate_invite_token error:", error);
    throw new Error("Nie udało się wygenerować nowego zaproszenia.");
  }

  // Docelowo: tu można jeszcze wywołać własne API z Resend
  console.log("ℹ️ Nowy token zaproszenia:", data);

  return data;
}

// --------------------------------------------------------
//   STRONA GŁÓWNA /team
// --------------------------------------------------------
export default async function TeamPage() {
  const supabase = await supabaseServer(); // ⬅⬅ DODANY await

  const { data, error } = await supabase
    .from("v_team_members_view")
    .select("*")
    .order("created_at", { ascending: true });

  const members = (data ?? []) as VTeamMember[];

  return (
    <RoleGuard allow={["owner", "manager", "storeman", "worker"]}>
      <section className="flex flex-col gap-4 md:gap-6">
        {/* Zakładki: Zespół / Brygady */}
        <TeamTabs />

        {/* Główny nagłówek + opis */}
        <header className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">
            Zespół
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Zarządzaj członkami zespołu przypisanymi do tego konta. Widzisz
            tutaj wszystkich zaproszonych, aktywnych i zablokowanych
            współpracowników oraz ich przypisanie do brygad.
          </p>
        </header>

        {/* Górny pasek: statystyka + formularz zaproszenia */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="rounded-2xl border border-border/70 bg-card/60 px-4 py-3 text-xs text-muted-foreground shadow-sm md:min-w-[220px]">
            {error ? (
              <div className="text-destructive">
                <div className="font-medium">
                  Nie udało się pobrać listy zespołu.
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
                    <span>Łącznie członków</span>
                    <span className="font-medium text-foreground">
                      {members.length}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          <InviteForm />
        </div>

        {/* Tabela z akcjami (client component) */}
        <TeamMembersTable
          members={members}
          onEdit={updateTeamMemberAction}
          onDelete={deleteTeamMemberAction}
          onResendInvite={resendInviteAction}
        />
      </section>
    </RoleGuard>
  );
}
