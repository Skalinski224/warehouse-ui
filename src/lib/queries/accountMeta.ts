// src/lib/queries/accountMeta.ts
import { supabaseServer } from "@/lib/supabaseServer";

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseISODateOnly(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d : null;
}

export async function getAccountCreatedAtISO(): Promise<string | null> {
  const sb = await supabaseServer();

  // bierzemy selected_account_id z Twojego kanonu
  const { data: snap, error: snapErr } = await sb.rpc("my_permissions_snapshot");
  if (snapErr) return null;

  const s = Array.isArray(snap) ? snap[0] : snap;
  const accountId = String((s as any)?.selected_account_id ?? "").trim();
  if (!accountId) return null;

  const { data, error } = await sb
    .from("accounts")
    .select("created_at")
    .eq("id", accountId)
    .maybeSingle();

  if (error) return null;

  const createdAt = String((data as any)?.created_at ?? "").trim();
  const d = parseISODateOnly(createdAt);
  if (!d) return null;

  return toISODate(d);
}
