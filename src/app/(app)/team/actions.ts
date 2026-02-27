// src/app/(app)/team/actions.ts
"use server";

import { supabaseServer } from "@/lib/supabaseServer";
import { PERM, can, type PermissionSnapshot } from "@/lib/permissions";

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

function requirePerm(snapshot: PermissionSnapshot | null, key: any, msg: string) {
  if (!can(snapshot, key)) {
    // ✅ ważne: NIE notFound(), bo to ucina flow i toast nie zadziała
    throw new Error(msg);
  }
}

function normEmail(v: unknown): string | null {
  const s = String(v ?? "").trim().toLowerCase();
  return s ? s : null;
}

function normText(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

/* ------------------------------ ACTIONS ------------------------------ */
export async function updateTeamMemberAction(form: {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  account_role?: string | null;
  crew_id?: string | null;
}) {
  const supabase = await supabaseServer();
  const snapshot = await fetchMyPermissionsSnapshot();

  const update: Record<string, any> = {};
  if ("first_name" in form) update.first_name = normText(form.first_name);
  if ("last_name" in form) update.last_name = normText(form.last_name);
  if ("email" in form) update.email = normEmail(form.email);
  if ("phone" in form) update.phone = normText(form.phone);
  if ("crew_id" in form) update.crew_id = form.crew_id ?? null;

  if (Object.keys(update).length === 0) return;

  const touchedKeys = Object.keys(update);
  const onlyCrewChange = touchedKeys.every((k) => k === "crew_id");

  if (onlyCrewChange) {
    requirePerm(snapshot, PERM.TEAM_MANAGE_CREWS, "Brak uprawnień do zmiany brygady.");
  } else {
    // u Ciebie dane kontaktowe są pod TEAM_MANAGE_ROLES
    requirePerm(snapshot, PERM.TEAM_MANAGE_ROLES, "Brak uprawnień do edycji danych członka zespołu.");
  }

  const { error } = await supabase.from("team_members").update(update).eq("id", form.id);

  if (error) {
    console.error("team_members update error:", error);
    throw new Error("Nie udało się zaktualizować danych członka zespołu.");
  }
}

export async function deleteTeamMemberAction(id: string) {
  const supabase = await supabaseServer();
  const snapshot = await fetchMyPermissionsSnapshot();

  requirePerm(snapshot, PERM.TEAM_REMOVE, "Brak uprawnień do usuwania członków zespołu.");

  const { error } = await supabase.rpc("delete_team_member", { p_member_id: id });

  if (error) {
    console.error("delete_team_member error:", error);
    throw new Error("Nie udało się usunąć członka zespołu.");
  }
}

export async function resendInviteAction(id: string) {
  const supabase = await supabaseServer();
  const snapshot = await fetchMyPermissionsSnapshot();

  requirePerm(snapshot, PERM.TEAM_INVITE, "Brak uprawnień do ponawiania zaproszeń.");

  const { data, error } = await supabase.rpc("rotate_invite_token", { p_member_id: id });

  if (error) {
    console.error("rotate_invite_token error:", error);
    throw new Error("Nie udało się wygenerować nowego zaproszenia.");
  }

  return data;
}