// src/lib/getCurrentRole.ts
// DEPRECATED: nie używamy już roli do gatingu UI.
// Źródło prawdy: my_permissions_snapshot() + permissions[].

import { getPermissionSnapshot } from "@/lib/currentUser";

export type AccountRole = "owner" | "manager" | "storeman" | "worker" | "foreman";

export async function getCurrentRole(): Promise<AccountRole | null> {
  const snap = await getPermissionSnapshot();
  return (snap?.role as AccountRole) ?? null;
}

// DEPRECATED: nie używaj. Zastąp can(snapshot, PERM.X)
export function canEditInventory(_role: AccountRole | null | undefined): boolean {
  return false;
}
