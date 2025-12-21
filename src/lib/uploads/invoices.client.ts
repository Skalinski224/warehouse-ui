// src/lib/uploads/invoices.client.ts
"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { buildInvoicePath, INVOICES_BUCKET } from "@/lib/uploads/invoicePaths";

export type UploadInvoiceClientParams = {
  supabase: SupabaseClient; // supabaseBrowser()
  file: File;
  accountId: string;
  deliveryId: string;
};

export type UploadInvoiceClientResult = {
  path: string | null;
  publicUrl: string | null;
  error: string | null;
};

function safeContentType(file: File): string {
  const t = (file.type || "").toLowerCase().trim();
  return t || "application/octet-stream";
}

/**
 * Upload faktury w CLIENT (RLS/storage policy ma to zablokować/puścić).
 * To jest wersja do komponentów "use client".
 */
export async function uploadInvoiceFileClient(
  params: UploadInvoiceClientParams
): Promise<UploadInvoiceClientResult> {
  const { supabase, file, accountId, deliveryId } = params;

  if (!accountId || !deliveryId) {
    return { path: null, publicUrl: null, error: "Brak accountId lub deliveryId" };
  }
  if (!(file instanceof File) || !file.size) {
    return { path: null, publicUrl: null, error: "Brak pliku faktury" };
  }

  const path = buildInvoicePath(accountId, deliveryId, file.name);

  const { error: uploadError } = await supabase.storage
    .from(INVOICES_BUCKET)
    .upload(path, file, {
      upsert: true,
      contentType: safeContentType(file),
    });

  if (uploadError) {
    return { path: null, publicUrl: null, error: uploadError.message || "Upload failed" };
  }

  const { data: pub } = supabase.storage.from(INVOICES_BUCKET).getPublicUrl(path);

  return {
    path,
    publicUrl: pub?.publicUrl ?? null,
    error: null,
  };
}
