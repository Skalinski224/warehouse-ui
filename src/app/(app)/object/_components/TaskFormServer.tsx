import TaskForm from "@/components/object/TaskForm";
import { supabaseServer } from "@/lib/supabaseServer";

type CrewOption = { id: string; name: string };
type MemberOption = { id: string; full_name: string };

async function fetchMemberOptions(): Promise<MemberOption[]> {
  const supabase = await supabaseServer();

  // 1) kto jest zalogowany
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  const userId = userRes?.user?.id ?? null;
  if (userErr || !userId) {
    console.error("fetchMemberOptions: auth.getUser() error:", userErr);
    return [];
  }

  // 2) z users bierzemy account_id (najbardziej stabilne w multi-tenant)
  const { data: urow, error: urowErr } = await supabase
    .from("users")
    .select("account_id")
    .eq("id", userId)
    .maybeSingle();

  if (urowErr) {
    console.error("fetchMemberOptions: users(account_id) error:", urowErr);
    return [];
  }

  const accountId = urow?.account_id ?? null;
  if (!accountId) {
    console.error("fetchMemberOptions: users.account_id is NULL (nie wybrano konta / brak select_account?)");
    return [];
  }

  // 3) lista aktywnych członków (bez soft-delete)
  const { data, error } = await supabase
    .from("team_members")
    .select("id, first_name, last_name, email, status, deleted_at")
    .eq("account_id", accountId)
    .is("deleted_at", null)
    .in("status", ["active"]) // jeśli masz inne statusy, dopisz
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });

  if (error) {
    console.error("fetchMemberOptions: team_members query error:", error);
    return [];
  }

  return (data ?? []).map((r: any) => {
    const fn = String(r.first_name ?? "").trim();
    const ln = String(r.last_name ?? "").trim();
    const email = String(r.email ?? "").trim();
    return {
      id: String(r.id),
      full_name: [fn, ln].filter(Boolean).join(" ") || email || "—",
    };
  });
}
