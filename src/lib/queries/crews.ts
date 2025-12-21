// src/lib/queries/crews.ts
import { supabaseServer } from "@/lib/supabaseServer";
import type { CrewWithMembers } from "@/lib/dto";

type MemberRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  crew_id: string | null;
  deleted_at: string | null;
};

export async function fetchMyDefaultCrew(): Promise<CrewWithMembers | null> {
  const supabase = await supabaseServer();

  // 1) Szukamy, w której brygadzie jest aktualny user (po team_members.user_id)
  const { data: userRes, error: userError } = await supabase.auth.getUser();
  if (userError || !userRes?.user) {
    console.warn("[fetchMyDefaultCrew] no auth user", userError);
    return null;
  }

  const userId = userRes.user.id;

  const { data: member, error: memberError } = await supabase
    .from("team_members")
    .select("id, crew_id")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (memberError) {
    console.error("[fetchMyDefaultCrew] team_members error:", memberError);
    return null;
  }

  if (!member?.crew_id) return null;
  const crewId = member.crew_id as string;

  // 2) Sama brygada
  const { data: crew, error: crewError } = await supabase
    .from("crews")
    .select("id, name")
    .eq("id", crewId)
    .maybeSingle();

  if (crewError || !crew) {
    if (crewError) {
      console.error("[fetchMyDefaultCrew] crews error:", crewError);
    }
    return null;
  }

  // 3) Członkowie tej brygady po team_members.crew_id
  const { data: crewMembers, error: cmError } = await supabase
    .from("team_members")
    .select("id, first_name, last_name, crew_id, deleted_at")
    .eq("crew_id", crew.id)
    .is("deleted_at", null);

  if (cmError) {
    console.error("[fetchMyDefaultCrew] team_members(crew) error:", cmError);
  }

  const members =
    (crewMembers ?? []).map((m: MemberRow) => ({
      id: m.id,
      firstName: m.first_name ?? "",
      lastName: m.last_name ?? null,
    })) ?? [];

  return {
    id: crew.id as string,
    name: (crew.name ?? "") as string,
    members,
  };
}

export async function fetchAllCrewsWithMembers(): Promise<CrewWithMembers[]> {
  const supabase = await supabaseServer();

  // 1) Lista brygad
  const { data: crewsData, error: crewsError } = await supabase
    .from("crews")
    .select("id, name")
    .order("name");

  if (crewsError) {
    console.error("[fetchAllCrewsWithMembers] crews error:", crewsError);
    return [];
  }

  const crews = (crewsData ?? []) as { id: string; name: string | null }[];

  if (crews.length === 0) {
    return [];
  }

  // 2) Wszyscy członkowie z przypisaną brygadą
  const { data: membersData, error: membersError } = await supabase
    .from("team_members")
    .select("id, first_name, last_name, crew_id, deleted_at")
    .is("deleted_at", null);

  if (membersError) {
    console.error("[fetchAllCrewsWithMembers] team_members error:", membersError);
  }

  const membersByCrew = new Map<string, { id: string; firstName: string; lastName: string | null }[]>();

  (membersData ?? []).forEach((m: MemberRow) => {
    if (!m.crew_id) return;
    const list = membersByCrew.get(m.crew_id) ?? [];
    list.push({
      id: m.id,
      firstName: m.first_name ?? "",
      lastName: m.last_name ?? null,
    });
    membersByCrew.set(m.crew_id, list);
  });

  // 3) Składamy CrewWithMembers
  return crews.map((c) => ({
    id: c.id,
    name: c.name ?? "",
    members: membersByCrew.get(c.id) ?? [],
  }));
}
