// src/lib/getImageUrl.ts
import "server-only";

import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { supabaseServer } from "@/lib/supabaseServer";
import { PERM, can } from "@/lib/permissions";

/**
 * 🔐 Zasada:
 * - ZAWSZE weryfikujemy account + permission po stronie serwera
 * - clientSide = true → TYLKO dla publicznych bucketów
 */

async function getSnapshot() {
  const supabase = await supabaseServer();
  const { data } = await supabase.rpc("my_permissions_snapshot");
  return Array.isArray(data) ? data[0] : data;
}

async function getCurrentAccountId(): Promise<string | null> {
  const supabase = await supabaseServer();
  const { data } = await supabase.rpc("current_account_id");
  if (typeof data === "string") return data;
  if (data && typeof data === "object") {
    return (data as any).current_account_id ?? null;
  }
  return null;
}

function assertPathMatchesAccount(path: string, accountId: string) {
  const prefix = `${accountId}/`;
  if (!path.startsWith(prefix)) {
    throw new Error("Access denied: foreign account asset");
  }
}

export async function getImageUrl(
  bucket: string,
  path: string | null | undefined,
  clientSide = false
): Promise<string | null> {
  if (!path) return null;

  // CLIENT — tylko publiczne bucket + po server gate
  if (clientSide) {
    // clientSide NIE MOŻE sam decydować
    return null;
  }

  // SERVER SIDE — twarda walidacja
  try {
    const supabase = await supabaseServer();
    const snapshot = await getSnapshot();
    const accountId = await getCurrentAccountId();

    if (!snapshot || !accountId) return null;

    assertPathMatchesAccount(path, accountId);

    // Permission per bucket
    const allowed =
      bucket === "material-images"
        ? can(snapshot, PERM.MATERIALS_READ)
        : bucket === "report-images"
        ? can(snapshot, PERM.DAILY_REPORTS_READ)
        : bucket === "invoices"
        ? can(snapshot, PERM.DELIVERIES_READ)
        : false;

    if (!allowed) return null;

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data?.publicUrl ?? null;
  } catch (err) {
    console.warn("getImageUrl blocked:", err);
    return null;
  }
}

/* ---------------------------------- ALIASY -------------------------------- */

export async function getMaterialImageUrl(
  path: string | null | undefined
): Promise<string | null> {
  return getImageUrl("material-images", path, false);
}

export async function getReportImageUrl(
  path: string | null | undefined
): Promise<string | null> {
  return getImageUrl("report-images", path, false);
}

export async function getInvoiceUrl(
  path: string | null | undefined
): Promise<string | null> {
  return getImageUrl("invoices", path, false);
}
