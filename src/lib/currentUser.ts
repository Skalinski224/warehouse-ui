import { supabaseServer } from "@/lib/supabaseServer";

export type CurrentUserInfo = {
  id: string;
  email: string;
  name: string;
  role: "manager" | "storeman" | "worker";
};

const ROLES = new Set(["manager", "storeman", "worker"] as const);

export async function getCurrentUserInfo(): Promise<CurrentUserInfo | null> {
  const sb = await supabaseServer();

  const { data: userData } = await sb.auth.getUser();
  const user = userData?.user;
  if (!user) return null;

  // Pobranie roli – nie używamy .single() na RPC zwracającym scalar.
  let role: CurrentUserInfo["role"] = "worker";
  const { data: roleData, error: roleErr } = await sb.rpc("current_app_role");

  if (!roleErr && typeof roleData === "string" && ROLES.has(roleData as any)) {
    role = roleData as CurrentUserInfo["role"];
  }

  const email = user.email ?? "";
  const metaName = (user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    "").toString().trim();
  const name = metaName || (email ? email.split("@")[0] : "Użytkownik");

  return { id: user.id, email, name, role };
}