// src/lib/currentUser.ts
import { supabaseServer } from "@/lib/supabaseServer";
import type { PermissionSnapshot } from "@/lib/permissions";

function toSafeSnapshot(row: any): PermissionSnapshot {
  const account_id =
    typeof row?.account_id === "string" || row?.account_id === null ? row.account_id : null;

  const role = typeof row?.role === "string" || row?.role === null ? row.role : null;

  const permissions = Array.isArray(row?.permissions)
    ? row.permissions.filter((x: unknown) => typeof x === "string")
    : [];

  return { account_id, role, permissions };
}

export async function getPermissionSnapshot(): Promise<PermissionSnapshot | null> {
  const sb = await supabaseServer();

  // ✅ jeśli SSR nie widzi usera -> nie ma sensu wołać RPC
  const { data: u } = await sb.auth.getUser();
  if (!u?.user) {
    return { account_id: null, role: null, permissions: [] };
  }

  const { data, error } = await sb.rpc("my_permissions_snapshot");

  if (error) {
    console.error("my_permissions_snapshot error:", error);
    return { account_id: null, role: null, permissions: [] };
  }

  const row = Array.isArray(data) ? (data[0] ?? null) : (data ?? null);
  if (!row) return { account_id: null, role: null, permissions: [] };

  return toSafeSnapshot(row);
}
