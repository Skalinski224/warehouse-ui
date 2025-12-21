import { redirect } from "next/navigation";
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

  // permissions snapshot (DB source of truth)
  const { data, error } = await supabase.rpc("my_permissions_snapshot");
  const snapshot = coerceSnapshot(data);

  if (!snapshot || error) redirect("/");

  // Każdy może wypełnić => ale tylko jeśli ma create
  if (!can(snapshot, PERM.DAILY_REPORTS_CREATE)) {
    redirect("/daily-reports");
  }

  // aktualny user – do "Osoba wypełniająca" + powiązanie z team_members
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user ?? null;

  let currentMemberId: string | null = null;
  let defaultPerson = "";

  if (user) {
    const metaFullName =
      ((user.user_metadata as any)?.full_name as string | undefined) ?? "";

    if (metaFullName && metaFullName.trim()) {
      defaultPerson = metaFullName.trim();
    } else {
      const { data: member } = await supabase
        .from("team_members")
        .select("id, first_name, last_name")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .maybeSingle();

      if (member) {
        currentMemberId = member.id as string;
        const name = `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim();
        if (name) {
          defaultPerson = name;
        }
      }
    }

    if (!defaultPerson) {
      defaultPerson = user.email ?? "";
    }
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
      <div>
        <h1 className="text-xl font-semibold">Nowy raport dzienny</h1>
        <p className="text-sm text-muted-foreground">
          Uzupełnij dzisiejszy raport: brygada, zadanie, zużyte materiały i status prac.
        </p>
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
