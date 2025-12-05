// src/lib/uploads/invoices.ts

import type { SupabaseClient } from "@supabase/supabase-js";

const INVOICES_BUCKET = "invoices";

/**
 * Buduje ścieżkę w buckecie "invoices" dla danej dostawy.
 * Przykład:  accountId/deliveries/<deliveryId>/1731973412345-faktura.pdf
 */
export function buildInvoicePath(
  accountId: string,
  deliveryId: string,
  fileName: string
): string {
  const safeAccount = (accountId || "unknown").trim();
  const safeDelivery = (deliveryId || "unknown").trim();

  const dotIdx = fileName.lastIndexOf(".");
  const base = dotIdx > -1 ? fileName.slice(0, dotIdx) : fileName;
  const ext = dotIdx > -1 ? fileName.slice(dotIdx + 1) : "pdf";

  const slugBase = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  const safeExt = ext.toLowerCase().replace(/[^a-z0-9]/g, "") || "pdf";

  const ts = Date.now();

  return `${safeAccount}/deliveries/${safeDelivery}/${ts}-${slugBase}.${safeExt}`;
}

export type UploadInvoiceParams = {
  supabase: SupabaseClient<any, "public", any>;
  file: File;
  accountId: string;
  deliveryId: string;
};

export type UploadInvoiceResult = {
  /** Ścieżka w buckecie (tę warto zapisać jako invoice_url w deliveries) */
  path: string | null;
  /** Publiczny URL, jeśli bucket jest publiczny; inaczej może nie działać bez podpisu */
  publicUrl: string | null;
  /** Treść błędu (jeśli coś poszło nie tak) */
  error: string | null;
};

/**
 * Upload faktury do bucketa "invoices".
 * Zwraca path (do zapisania w deliveries.invoice_url) oraz publicUrl (jeśli potrzebujesz).
 */
export async function uploadInvoiceFile(
  params: UploadInvoiceParams
): Promise<UploadInvoiceResult> {
  const { supabase, file, accountId, deliveryId } = params;

  if (!file || file.size === 0) {
    return { path: null, publicUrl: null, error: "Brak pliku faktury" };
  }

  const path = buildInvoicePath(accountId, deliveryId, file.name);

  const { error: uploadError } = await supabase.storage
    .from(INVOICES_BUCKET)
    .upload(path, file, {
      upsert: true,
      contentType: file.type || "application/octet-stream",
    });

  if (uploadError) {
    console.warn("uploadInvoiceFile error:", uploadError.message);
    return {
      path: null,
      publicUrl: null,
      error: uploadError.message || "Nie udało się wgrać faktury",
    };
  }

  // Nawet jeśli bucket jest prywatny, getPublicUrl zwróci URL,
  // ale dostęp może wymagać podpisu. To pole jest opcjonalne.
  const { data: pub } = supabase.storage
    .from(INVOICES_BUCKET)
    .getPublicUrl(path);

  return {
    path,
    publicUrl: pub?.publicUrl ?? null,
    error: null,
  };
}

export type GetSignedUrlParams = {
  supabase: SupabaseClient<any, "public", any>;
  /** Ścieżka w buckecie, np. to co zapisaliśmy w deliveries.invoice_url */
  path: string;
  /** Czas ważności linku w sekundach (domyślnie 1h) */
  expiresIn?: number;
};

/**
 * Tworzy podpisany URL do faktury na podstawie ścieżki w buckecie.
 * Użyteczne w raportach / widoku szczegółowym dostawy przy prywatnym buckecie.
 */
export async function getInvoiceSignedUrl(
  params: GetSignedUrlParams
): Promise<string | null> {
  const { supabase, path, expiresIn = 3600 } = params;

  if (!path) return null;

  const { data, error } = await supabase.storage
    .from(INVOICES_BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error) {
    console.warn("getInvoiceSignedUrl error:", error.message);
    return null;
  }

  return data?.signedUrl ?? null;
}

/**
 * Opcjonalnie: usuwanie starej faktury z bucketa, np. przy podmianie pliku.
 */
export async function deleteInvoiceFile(
  supabase: SupabaseClient<any, "public", any>,
  path: string | null | undefined
): Promise<void> {
  if (!path) return;

  const { error } = await supabase.storage
    .from(INVOICES_BUCKET)
    .remove([path]);

  if (error) {
    console.warn("deleteInvoiceFile error:", error.message);
  }
}
