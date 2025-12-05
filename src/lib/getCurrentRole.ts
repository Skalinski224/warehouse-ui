// src/lib/getCurrentRole.ts
import { supabaseServer } from "@/lib/supabaseServer";

export type AccountRole = "owner" | "manager" | "storeman" | "worker";

export async function getCurrentRole(): Promise<AccountRole | null> {
  const supabase = await supabaseServer(); // musi być await

  const { data, error } = await supabase.rpc("role_in_account");

  if (error) {
    console.error("role_in_account RPC error:", error);
    return null;
  }

  const raw = data as any;

  // Obsługa kilku możliwych kształtów zwrotki:
  // 1) 'manager'
  // 2) { role: 'manager' }
  // 3) ['manager'] lub [{ role: 'manager' }]
  let role: AccountRole | null = null;

  if (!raw) {
    role = null;
  } else if (typeof raw === "string") {
    role = raw as AccountRole;
  } else if (Array.isArray(raw)) {
    const first = raw[0];
    if (!first) {
      role = null;
    } else if (typeof first === "string") {
      role = first as AccountRole;
    } else if (typeof first === "object" && "role" in first) {
      role = first.role as AccountRole;
    }
  } else if (typeof raw === "object" && "role" in raw) {
    role = raw.role as AccountRole;
  }

  return role ?? null;
}

// 🔹 Helper używany m.in. w /materials
export function canEditInventory(role: AccountRole | null | undefined): boolean {
  if (!role) return false;
  return role === "owner" || role === "manager" || role === "storeman";
}
