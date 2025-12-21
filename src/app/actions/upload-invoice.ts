// src/app/actions/upload-invoice.ts
"use server";
import "server-only";

import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabaseServer";
import { PERM, canAny } from "@/lib/permissions";
import { INVOICES_BUCKET, buildInvoicePath } from "@/lib/uploads/invoicePaths";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!url || !serviceKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const storageAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

async function getSnapshot() {
  const sb = await supabaseServer();
  const { data, error } = await sb.rpc("my_permissions_snapshot");
  if (error) return null;
  return Array.isArray(data) ? (data[0] ?? null) : (data ?? null);
}

async function getCurrentAccountId(): Promise<string | null> {
  const sb = await supabaseServer();
  const { data, error } = await sb.rpc("current_account_id");
  if (error) return null;

  if (typeof data === "string") return data;
  if (data && typeof data === "object") {
    const maybe = (data as any).current_account_id ?? (data as any).account_id ?? null;
    return typeof maybe === "string" ? maybe : null;
  }
  return null;
}

/**
 * Upload faktury (SERVER ACTION):
 * - accountId z sesji (current_account_id)
 * - permission gate: DELIVERIES_CREATE lub DELIVERIES_UPDATE_UNAPPROVED
 * - upload przez service role do bucketa "invoices"
 *
 * FormData:
 * - file: File
 * - deliveryId: string
 */
export async function uploadInvoice(formData: FormData) {
  const file = formData.get("file") as File | null;
  const deliveryIdRaw = formData.get("deliveryId");

  const deliveryId =
    typeof deliveryIdRaw === "string" ? deliveryIdRaw.trim() : "";

  if (!file || file.size === 0) throw new Error("Brak pliku faktury");
  if (!deliveryId) throw new Error("Brak deliveryId");

  const snap = await getSnapshot();
  if (!snap) throw new Error("Brak autoryzacji");

  if (!canAny(snap, [PERM.DELIVERIES_CREATE, PERM.DELIVERIES_UPDATE_UNAPPROVED])) {
    throw new Error("Brak uprawnień do uploadu faktury");
  }

  const accountId = await getCurrentAccountId();
  if (!accountId) throw new Error("Brak konta (current_account_id)");

  // ✅ spójna, kanoniczna ścieżka dla faktur
  const path = buildInvoicePath(accountId, deliveryId, file.name);

  const { error } = await storageAdmin.storage.from(INVOICES_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || "application/octet-stream",
  });

  if (error) throw error;

  return { bucket: INVOICES_BUCKET, path };
}
