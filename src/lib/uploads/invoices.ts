// src/lib/uploads/invoices.server.ts
import "server-only";

import { supabaseServer } from "@/lib/supabaseServer";
import {
  PERM,
  canAny,
  can,
  type PermissionKey,
  type PermissionSnapshot,
} from "@/lib/permissions";
import { buildInvoicePath, INVOICES_BUCKET } from "@/lib/uploads/invoicePaths";

export type UploadInvoiceParams = {
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

export type GetSignedUrlParams = {
  /** Ścieżka w buckecie, np. to co zapisaliśmy w deliveries.invoice_url */
  path: string;
  /** Czas ważności linku w sekundach (domyślnie 1h) */
  expiresIn?: number;
};

/* -------------------------------------------------------------------------- */
/*                               INTERNAL HELPERS                             */
/* -------------------------------------------------------------------------- */

type SbClient = Awaited<ReturnType<typeof supabaseServer>>;

async function getSnapshot(sb: SbClient): Promise<PermissionSnapshot | null> {
  const { data, error } = await sb.rpc("my_permissions_snapshot");
  if (error) return null;
  return (Array.isArray(data) ? (data[0] ?? null) : (data ?? null)) as any;
}

async function getCurrentAccountId(sb: SbClient): Promise<string | null> {
  const { data, error } = await sb.rpc("current_account_id");
  if (error) return null;

  if (typeof data === "string") return data;

  if (data && typeof data === "object") {
    const maybe = (data as any).current_account_id ?? (data as any).account_id ?? null;
    return typeof maybe === "string" ? maybe : null;
  }

  return null;
}

async function guardAccountAndPerm(
  sb: SbClient,
  paramsAccountId: string,
  needAnyPerm: PermissionKey[]
): Promise<
  | { ok: true; snap: PermissionSnapshot; currentAccountId: string }
  | { ok: false; error: string }
> {
  const [snap, currentAccountId] = await Promise.all([getSnapshot(sb), getCurrentAccountId(sb)]);

  if (!snap || !currentAccountId) {
    return { ok: false, error: "Brak autoryzacji" };
  }

  if (currentAccountId !== paramsAccountId) {
    return { ok: false, error: "Brak dostępu (account mismatch)" };
  }

  if (!canAny(snap, needAnyPerm)) {
    return { ok: false, error: "Brak uprawnień" };
  }

  return { ok: true, snap, currentAccountId };
}

function safeContentType(file: File): string {
  const t = (file.type || "").toLowerCase().trim();
  // Twardy fallback; nie blokujemy uploadu tylko dlatego, że browser nie podał typu.
  return t || "application/octet-stream";
}

function safeFileName(file: File): string {
  const raw = String(file?.name || "invoice");
  const base = raw.split(/[/\\]/).pop() || "invoice";
  const cleaned = base.replace(/[^\w.\-() ]+/g, "_").trim();
  if (!cleaned || cleaned === "." || cleaned === ".." || cleaned.includes("..")) return "invoice";
  return cleaned;
}

function isSafeStoragePath(path: string): boolean {
  const p = (path || "").trim();
  if (!p) return false;
  if (p.startsWith("/")) return false;
  if (p.includes("..")) return false;
  return true;
}

/* -------------------------------------------------------------------------- */
/*                                  API                                       */
/* -------------------------------------------------------------------------- */

/**
 * Upload faktury do bucketa "invoices".
 * Zwraca path (do zapisania w deliveries.invoice_url) oraz publicUrl (jeśli bucket publiczny).
 *
 * UWAGA: To jest SERVER-ONLY. Wywołuj przez Server Action / Route Handler.
 */
export async function uploadInvoiceFile(
  params: UploadInvoiceParams
): Promise<UploadInvoiceResult> {
  const { file, accountId, deliveryId } = params;

  if (!accountId || !deliveryId) {
    return { path: null, publicUrl: null, error: "Brak accountId lub deliveryId" };
  }

  if (!file || typeof file.size !== "number" || file.size <= 0) {
    return { path: null, publicUrl: null, error: "Brak pliku faktury" };
  }

  const sb = await supabaseServer();

  // ✅ Gate: tylko ktoś kto może tworzyć/edytować dostawy może uploadować fakturę
  const guard = await guardAccountAndPerm(sb, accountId, [
    PERM.DELIVERIES_CREATE,
    PERM.DELIVERIES_UPDATE_UNAPPROVED,
  ]);

  if (!guard.ok) {
    return { path: null, publicUrl: null, error: guard.error };
  }

  const path = buildInvoicePath(accountId, deliveryId, safeFileName(file));

  // ✅ multi-tenant + path traversal hardening
  if (!isSafeStoragePath(path) || !path.startsWith(`${accountId}/`)) {
    return { path: null, publicUrl: null, error: "Nieprawidłowa ścieżka uploadu" };
  }

  const { error: uploadError } = await sb.storage.from(INVOICES_BUCKET).upload(path, file, {
    upsert: true, // zachowuję Twoje zachowanie; zabezpieczenia są w guardzie + prefixie
    contentType: safeContentType(file),
  });

  if (uploadError) {
    console.warn("uploadInvoiceFile error:", uploadError.message);
    return {
      path: null,
      publicUrl: null,
      error: uploadError.message || "Nie udało się wgrać faktury",
    };
  }

  // Jeśli bucket publiczny – będzie działać; jeśli prywatny – używaj signed url.
  const { data: pub } = sb.storage.from(INVOICES_BUCKET).getPublicUrl(path);

  return {
    path,
    publicUrl: pub?.publicUrl ?? null,
    error: null,
  };
}

/**
 * Tworzy podpisany URL do faktury na podstawie ścieżki w buckecie.
 * Przydatne gdy bucket jest prywatny.
 *
 * UWAGA: SERVER-ONLY. Wywołuj przez Server Action / Route Handler.
 */
export async function getInvoiceSignedUrl(params: GetSignedUrlParams): Promise<string | null> {
  const { path, expiresIn = 3600 } = params;
  if (!path) return null;
  if (!isSafeStoragePath(path)) return null;

  const sb = await supabaseServer();
  const snap = await getSnapshot(sb);
  if (!snap) return null;

  // Musi mieć uprawnienia do czytania faktur w raportach albo ogólnie dostaw
  if (!can(snap, PERM.REPORTS_DELIVERIES_INVOICES_READ) && !can(snap, PERM.DELIVERIES_READ)) {
    return null;
  }

  const currentAccountId = await getCurrentAccountId(sb);
  if (!currentAccountId) return null;

  // multi-tenant: ścieżka musi należeć do aktualnego konta
  if (!path.startsWith(`${currentAccountId}/`)) return null;

  const { data, error } = await sb.storage.from(INVOICES_BUCKET).createSignedUrl(path, expiresIn);

  if (error) {
    console.warn("getInvoiceSignedUrl error:", error.message);
    return null;
  }

  return data?.signedUrl ?? null;
}

/**
 * Usuwa fakturę z bucketa (np. przy podmianie pliku).
 *
 * UWAGA: SERVER-ONLY. Wywołuj przez Server Action / Route Handler.
 */
export async function deleteInvoiceFile(path: string | null | undefined): Promise<void> {
  if (!path) return;
  if (!isSafeStoragePath(path)) return;

  const sb = await supabaseServer();
  const snap = await getSnapshot(sb);
  if (!snap) return;

  if (
    !canAny(snap, [PERM.DELIVERIES_UPDATE_UNAPPROVED, PERM.DELIVERIES_DELETE_UNAPPROVED])
  ) {
    return;
  }

  const currentAccountId = await getCurrentAccountId(sb);
  if (!currentAccountId) return;

  // multi-tenant: nie pozwalamy usuwać cudzych ścieżek
  if (!path.startsWith(`${currentAccountId}/`)) return;

  const { error } = await sb.storage.from(INVOICES_BUCKET).remove([path]);
  if (error) {
    console.warn("deleteInvoiceFile error:", error.message);
  }
}