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
  error: string | null;
};

export type SignedUrlResult = {
  signedUrl: string | null;
  error: string | null;
};

function safeContentType(file: File): string {
  const t = (file.type || "").toLowerCase().trim();
  return t || "application/octet-stream";
}

/** Minimalny sanity-check ścieżek z user input */
function isSafeStoragePath(path: string): boolean {
  const p = (path || "").trim();
  if (!p) return false;
  if (p.startsWith("/")) return false;
  if (p.includes("..")) return false;
  // Supabase storage używa "/" jako separatora - akceptujemy tylko "a/b/c"
  return true;
}

function safeFileName(file: File): string {
  const raw = String(file?.name || "invoice");
  // usuń próby podania ścieżki
  const base = raw.split(/[/\\]/).pop() || "invoice";
  // usuń podejrzane znaki
  const cleaned = base.replace(/[^\w.\-() ]+/g, "_").trim();
  // nie pozwól na ".."
  if (!cleaned || cleaned === "." || cleaned === ".." || cleaned.includes("..")) return "invoice";
  return cleaned;
}

function isClientUploadExplicitlyAllowed(): boolean {
  // Domyślnie: ZABRONIONE. Żeby włączyć, trzeba świadomie ustawić flagę.
  // (nie zmienia to importów ani API, ale zamyka dziurę "ktoś przypadkiem użył client upload").
  return String(process.env.NEXT_PUBLIC_ALLOW_INVOICE_CLIENT_UPLOAD || "") === "true";
}

/**
 * Upload faktury w CLIENT (RLS/storage policy ma to zablokować/puścić).
 *
 * ⚠️ SECURITY: domyślnie WYŁĄCZONE.
 * Faktury uploadujemy przez SERVER (`uploadInvoiceFile` przez server action / route),
 * bo tam masz twarde sprawdzenie accountId + permissions.
 *
 * Jeśli chcesz chwilowo dopuścić upload z clienta (np. na DEV), ustaw:
 * NEXT_PUBLIC_ALLOW_INVOICE_CLIENT_UPLOAD="true"
 */
export async function uploadInvoiceFileClient(
  params: UploadInvoiceClientParams
): Promise<UploadInvoiceClientResult> {
  if (!isClientUploadExplicitlyAllowed()) {
    return {
      path: null,
      error:
        'Client upload faktur jest wyłączony (SECURITY). Użyj server action. Aby świadomie włączyć: NEXT_PUBLIC_ALLOW_INVOICE_CLIENT_UPLOAD="true".',
    };
  }

  const { supabase, file, accountId, deliveryId } = params;

  if (!accountId || !deliveryId) {
    return { path: null, error: "Brak accountId lub deliveryId" };
  }
  if (!(file instanceof File) || !file.size) {
    return { path: null, error: "Brak pliku faktury" };
  }

  const path = buildInvoicePath(accountId, deliveryId, safeFileName(file));
  if (!isSafeStoragePath(path) || !path.startsWith(`${accountId}/`)) {
    return { path: null, error: "Nieprawidłowa ścieżka uploadu" };
  }

  // WAŻNE: faktury/dokumenty nie powinny się nadpisywać przypadkiem
  const { error: uploadError } = await supabase.storage
    .from(INVOICES_BUCKET)
    .upload(path, file, {
      upsert: false,
      contentType: safeContentType(file),
    });

  if (uploadError) {
    return { path: null, error: uploadError.message || "Upload failed" };
  }

  return { path, error: null };
}

/**
 * Signed URL do podglądu w aplikacji (private bucket).
 * Dajemy krótki TTL – wystarczy do obejrzenia/pobrania.
 *
 * ⚠️ SECURITY: to jest client-side. Jeśli masz możliwość, preferuj
 * server-only `getInvoiceSignedUrl()` (tam weryfikujesz konto + permissions + prefix).
 */
export async function createInvoiceSignedUrlClient(params: {
  supabase: SupabaseClient;
  path: string;
  expiresInSeconds?: number;
  /** Opcjonalnie: dodatkowy bezpiecznik multi-tenant po stronie UI */
  accountId?: string;
}): Promise<SignedUrlResult> {
  const { supabase, path, expiresInSeconds = 120, accountId } = params;

  if (!path) return { signedUrl: null, error: "Brak ścieżki pliku" };
  if (!isSafeStoragePath(path)) return { signedUrl: null, error: "Nieprawidłowa ścieżka" };
  if (accountId && !path.startsWith(`${accountId}/`)) {
    return { signedUrl: null, error: "Brak dostępu (account mismatch)" };
  }

  const { data, error } = await supabase.storage
    .from(INVOICES_BUCKET)
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data?.signedUrl) {
    return { signedUrl: null, error: error?.message || "createSignedUrl failed" };
  }

  return { signedUrl: data.signedUrl, error: null };
}

/**
 * Pobranie pliku bez otwierania zewnętrznej zakładki.
 *
 * ⚠️ SECURITY: to działa tylko jeśli polityki storage pozwalają.
 * Jeśli chcesz twardą kontrolę uprawnień – rób download przez backend (Route/Action) + signed url.
 */
export async function downloadInvoiceFileClient(params: {
  supabase: SupabaseClient;
  path: string;
  filename?: string;
  /** Opcjonalnie: dodatkowy bezpiecznik multi-tenant po stronie UI */
  accountId?: string;
}): Promise<{ error: string | null }> {
  const { supabase, path, filename, accountId } = params;

  if (!path) return { error: "Brak ścieżki pliku" };
  if (!isSafeStoragePath(path)) return { error: "Nieprawidłowa ścieżka" };
  if (accountId && !path.startsWith(`${accountId}/`)) {
    return { error: "Brak dostępu (account mismatch)" };
  }

  const { data, error } = await supabase.storage.from(INVOICES_BUCKET).download(path);

  if (error || !data) {
    return { error: error?.message || "download failed" };
  }

  const blobUrl = URL.createObjectURL(data);
  try {
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename || path.split("/").pop() || "plik";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(blobUrl);
  }

  return { error: null };
}