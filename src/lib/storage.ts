// src/lib/storage.ts
"use server";
import "server-only";

import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { supabaseServer } from "@/lib/supabaseServer";
import { PERM, canAny } from "@/lib/permissions";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // TYLKO na serwerze

if (!url || !serviceKey) {
  throw new Error(
    "Brak NEXT_PUBLIC_SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY w env."
  );
}

// Klient z service_role (pełny dostęp do Storage)
const supa = createClient(url, serviceKey);

type UploadResult = {
  bucket: string;
  path: string;
  publicUrl: string;
  existed: boolean;
};

/** Rozszerzenie z MIME lub nazwy pliku */
function inferExt(contentType?: string | null, filename?: string | null): string {
  if (contentType && contentType.includes("/")) {
    const maybe = contentType.split("/")[1]?.toLowerCase();
    if (maybe) return maybe;
  }
  if (filename && filename.includes(".")) {
    const ext = filename.split(".").pop()?.toLowerCase();
    if (ext) return ext;
  }
  return "jpg";
}

/** Bezpieczne rozpoznanie konfliktu (409) bez zależności od typu błędu */
function isConflict(err: unknown): boolean {
  const any = err as any;
  const code = any?.status ?? any?.statusCode ?? any?.error?.statusCode;
  if (code === 409) return true;
  const msg = String(any?.message ?? any ?? "");
  return /409|already exists|duplicate|conflict/i.test(msg);
}

/** Prosty guard przeciw traversal / dziwnym ścieżkom */
function isSafeStoragePath(p: string): boolean {
  const s = String(p ?? "");
  if (!s) return false;
  if (s.startsWith("/")) return false;
  if (s.includes("..")) return false;
  if (s.includes("\\")) return false;
  if (s.includes("\0")) return false;
  return true;
}

function looksLikeUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s
  );
}

/** Publiczny URL */
export function getPublicUrl(bucket: string, path: string): string {
  const { data } = supa.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/* -------------------------------------------------------------------------- */
/*                               SECURITY GUARDS                              */
/* -------------------------------------------------------------------------- */

async function getSnapshot() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("my_permissions_snapshot");
  if (error) return null;
  return Array.isArray(data) ? (data[0] ?? null) : (data ?? null);
}

async function getCurrentAccountId(): Promise<string | null> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("current_account_id");
  if (error) return null;

  const v = Array.isArray(data) ? data[0] : data;
  if (typeof v === "string") return v;

  if (v && typeof v === "object") {
    const maybe = (v as any).current_account_id ?? (v as any).account_id ?? null;
    return typeof maybe === "string" ? maybe : null;
  }

  return null;
}

async function assertAccountMatch(accountId: string) {
  const current = await getCurrentAccountId();
  if (!current || current !== accountId) {
    throw new Error("Brak dostępu (account mismatch).");
  }
}

async function assertPathAccountMatch(path: string) {
  if (!isSafeStoragePath(path)) {
    throw new Error("Brak dostępu (nieprawidłowa ścieżka obiektu).");
  }

  const first = String(path ?? "").split("/")[0] ?? "";
  if (!first || !looksLikeUuid(first)) {
    throw new Error("Brak dostępu (nieprawidłowa ścieżka obiektu).");
  }

  await assertAccountMatch(first);
}

async function assertCanUploadMaterialImage() {
  const snap = await getSnapshot();
  const ok = canAny(snap, [PERM.MATERIALS_WRITE]);
  if (!ok) throw new Error("Brak dostępu (materials.write).");
}

/* -------------------------------------------------------------------------- */
/*                                    API                                     */
/* -------------------------------------------------------------------------- */

/**
 * Upload z deduplikacją po SHA-256 treści:
 *   ścieżka = {accountId}/materials/{hash}.{ext}
 * Gdy istnieje – zwraca istniejący URL, nie nadpisuje niczego.
 */
export async function uploadMaterialImage(params: {
  accountId: string;
  file: File | Blob;
  filename?: string | null;
  bucket?: string;
}): Promise<UploadResult> {
  const bucket = params.bucket ?? "material-images";
  const { accountId, file, filename } = params;

  if (!accountId) throw new Error("uploadMaterialImage: wymagany accountId");
  if (!file) throw new Error("uploadMaterialImage: brak pliku");

  // ✅ Guards
  await assertCanUploadMaterialImage();
  await assertAccountMatch(accountId);

  const ab = await file.arrayBuffer();
  const bytes = new Uint8Array(ab);
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 40);

  const ext = inferExt((file as any).type ?? null, filename ?? null);
  const path = `${accountId}/materials/${hash}.${ext}`;

  const { error: upErr } = await supa.storage.from(bucket).upload(path, file, {
    cacheControl: "31536000",
    upsert: false,
    contentType: (file as any).type || "image/jpeg",
  });

  if (upErr) {
    if (isConflict(upErr)) {
      return { bucket, path, publicUrl: getPublicUrl(bucket, path), existed: true };
    }
    throw upErr;
  }

  return { bucket, path, publicUrl: getPublicUrl(bucket, path), existed: false };
}

/**
 * Upload o „ładnej” nazwie powiązanej z materialId, ale dalej z dedupe:
 *   ścieżka = {accountId}/materials/{materialId}-{shortHash}.{ext}
 */
export async function uploadMaterialImageNamed(params: {
  accountId: string;
  materialId: string;
  file: File | Blob;
  filename?: string | null;
  bucket?: string;
}): Promise<UploadResult> {
  const bucket = params.bucket ?? "material-images";
  const { accountId, materialId, file, filename } = params;

  if (!materialId) throw new Error("uploadMaterialImageNamed: wymagany materialId");
  if (!accountId) throw new Error("uploadMaterialImageNamed: wymagany accountId");
  if (!file) throw new Error("uploadMaterialImageNamed: brak pliku");

  // ✅ Guards
  await assertCanUploadMaterialImage();
  await assertAccountMatch(accountId);

  const ab = await file.arrayBuffer();
  const bytes = new Uint8Array(ab);
  const shortHash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);

  const ext = inferExt((file as any).type ?? null, filename ?? null);
  const path = `${accountId}/materials/${materialId}-${shortHash}.${ext}`;

  const { error: upErr } = await supa.storage.from(bucket).upload(path, file, {
    cacheControl: "31536000",
    upsert: false,
    contentType: (file as any).type || "image/jpeg",
  });

  if (upErr) {
    if (isConflict(upErr)) {
      return { bucket, path, publicUrl: getPublicUrl(bucket, path), existed: true };
    }
    throw upErr;
  }

  return { bucket, path, publicUrl: getPublicUrl(bucket, path), existed: false };
}

/** Podpisywanie obiektu (gdy bucket prywatny) */
export async function signObject(
  bucket: string,
  path: string,
  expiresInSec = 900
): Promise<string> {
  // ✅ bucket allow-list (żeby nikt nie podpisywał "dowolnego" bucketa service_role)
  const allowedBuckets = new Set(["material-images", "report-images", "invoices"]);
  if (!allowedBuckets.has(bucket)) {
    throw new Error("Brak dostępu (bucket not allowed).");
  }

  if (!isSafeStoragePath(path)) {
    throw new Error("Brak dostępu (nieprawidłowa ścieżka obiektu).");
  }

  // ✅ Guard: nie podpisujemy obcych accountów
  await assertPathAccountMatch(path);

  // ✅ sanity expires
  const exp = Number(expiresInSec);
  const safeExp = Number.isFinite(exp) ? Math.min(Math.max(exp, 60), 60 * 60) : 900;

  const { data, error } = await supa.storage
    .from(bucket)
    .createSignedUrl(path, safeExp);

  if (error) throw error;
  return data.signedUrl;
}