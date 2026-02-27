// src/app/(app)/daily-reports/new/page.tsx
import { redirect } from "next/navigation";
import BackButton from "@/components/BackButton";
import { supabaseServer } from "@/lib/supabaseServer";
import { fetchMyDefaultCrew, fetchAllCrewsWithMembers } from "@/lib/queries/crews";
import { fetchActiveMaterials } from "@/lib/queries/materials";
import { fetchTasksForCrewOrMember } from "@/lib/queries/tasks";
import DailyReportForm from "@/components/daily-reports/DailyReportForm";
import type { CrewWithMembers, MaterialOption, TaskOption } from "@/lib/dto";
import { can, PERM, type PermissionSnapshot } from "@/lib/permissions";

export const dynamic = "force-dynamic";

function coerceSnapshot(data: any): PermissionSnapshot | null {
  if (!data) return null;
  if (Array.isArray(data)) return (data[0] as PermissionSnapshot | null) ?? null;
  return data as PermissionSnapshot;
}

export default async function NewDailyReportPage() {
  const supabase = await supabaseServer();

  const { data, error } = await supabase.rpc("my_permissions_snapshot");
  const snapshot = coerceSnapshot(data);

  if (!snapshot || error) redirect("/");

  if (!can(snapshot, PERM.DAILY_REPORTS_CREATE)) {
    redirect("/daily-reports");
  }

  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user ?? null;

  let currentMemberId: string | null = null;
  let defaultPerson = "";

  if (user) {
    // 1) users.name
    const { data: prof, error: pErr } = await supabase
      .from("users")
      .select("name")
      .eq("id", user.id)
      .maybeSingle();

    if (pErr) console.warn("NewDailyReportPage: users profile fetch error:", pErr);

    const usersName = String((prof as any)?.name ?? "").trim();
    if (usersName) defaultPerson = usersName;

    // 2) team_members
    if (!defaultPerson) {
      const { data: member, error: mErr } = await supabase
        .from("team_members")
        .select("id, first_name, last_name")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .maybeSingle();

      if (mErr) console.warn("NewDailyReportPage: team_members fetch error:", mErr);

      if (member) {
        currentMemberId = member.id as string;
        const name = `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim();
        if (name) defaultPerson = name;
      }
    }

    // 3) user_metadata
    if (!defaultPerson) {
      const metaFullName = String(((user.user_metadata as any)?.full_name ?? "") as string).trim();
      if (metaFullName) defaultPerson = metaFullName;
    }

    if (!defaultPerson) defaultPerson = "Użytkownik";
  }

  const defaultCrewPromise = fetchMyDefaultCrew();
  const crewsPromise = fetchAllCrewsWithMembers();
  const materialsPromise = fetchActiveMaterials();

  const [defaultCrew, crews, materials] = (await Promise.all([
    defaultCrewPromise,
    crewsPromise,
    materialsPromise,
  ])) as [CrewWithMembers | null, CrewWithMembers[], MaterialOption[]];

  const defaultCrewId = defaultCrew?.id ?? null;

  const tasks = (await fetchTasksForCrewOrMember({
    crewId: defaultCrewId,
    memberId: currentMemberId,
  })) as TaskOption[];

  return (
    <div className="space-y-4">
      {/* HEADER: jak reszta modułów */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-sm font-medium">Nowy raport dzienny</h1>
          <p className="text-xs text-muted-foreground">
            Uzupełnij raport: brygada, zadanie, zużyte materiały i status prac.
          </p>
        </div>

        <div className="shrink-0">
          <BackButton />
        </div>
      </div>

      <DailyReportForm
        defaultCrew={defaultCrew}
        crews={crews}
        materials={materials}
        tasks={tasks}
        defaultPerson={defaultPerson}
        currentMemberId={currentMemberId}
      />
    </div>
  );
}