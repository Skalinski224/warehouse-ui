// src/lib/storage.ts
"use server";
import "server-only";

import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { supabaseServer } from "@/lib/supabaseServer";
import { PERM, can, canAny } from "@/lib/permissions";

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
  existed: boolean; // true → identyczny plik już był / plik o tej ścieżce istnieje
};

/** Rozszerzenie z MIME lub nazwy pliku */
function inferExt(
  contentType?: string | null,
  filename?: string | null
): string {
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
  // Jeśli masz funkcję current_account_id() wystawioną jako RPC:
  const { data, error } = await supabase.rpc("current_account_id");
  if (error) return null;
  const v = Array.isArray(data) ? data[0] : data;
  if (typeof v === "string") return v;
  // czasem supabase zwraca { current_account_id: "..." }
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

function looksLikeUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s
  );
}

async function assertPathAccountMatch(path: string) {
  const first = String(path ?? "").split("/")[0] ?? "";
  if (!first || !looksLikeUuid(first)) {
    // jeśli path nie jest w formacie accountId/..., to nie podpisujemy “w ciemno”
    throw new Error("Brak dostępu (nieprawidłowa ścieżka obiektu).");
  }
  await assertAccountMatch(first);
}

async function assertCanUploadMaterialImage() {
  const snap = await getSnapshot();
  // upload obrazu materiału = edycja materiałów
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
  bucket?: string; // domyślnie 'material-images'
}): Promise<UploadResult> {
  const bucket = params.bucket ?? "material-images";
  const { accountId, file, filename } = params;

  if (!accountId) throw new Error("uploadMaterialImage: wymagany accountId");
  if (!file) throw new Error("uploadMaterialImage: brak pliku");

  // ✅ Guards: permission + account match (nie ufamy params.accountId)
  await assertCanUploadMaterialImage();
  await assertAccountMatch(accountId);

  // Hash treści (dedupe) – używamy Uint8Array zamiast Buffer
  const ab = await file.arrayBuffer();
  const bytes = new Uint8Array(ab);
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 40);

  const ext = inferExt((file as any).type ?? null, filename ?? null);
  const path = `${accountId}/materials/${hash}.${ext}`;

  // Spróbuj upload z upsert=false (najtańsza detekcja konfliktu)
  const { error: upErr } = await supa.storage.from(bucket).upload(path, file, {
    cacheControl: "31536000",
    upsert: false,
    contentType: (file as any).type || "image/jpeg",
  });

  if (upErr) {
    if (isConflict(upErr)) {
      return {
        bucket,
        path,
        publicUrl: getPublicUrl(bucket, path),
        existed: true,
      };
    }
    throw upErr;
  }

  return {
    bucket,
    path,
    publicUrl: getPublicUrl(bucket, path),
    existed: false,
  };
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

  if (!materialId)
    throw new Error("uploadMaterialImageNamed: wymagany materialId");
  if (!accountId) throw new Error("uploadMaterialImageNamed: wymagany accountId");
  if (!file) throw new Error("uploadMaterialImageNamed: brak pliku");

  // ✅ Guards
  await assertCanUploadMaterialImage();
  await assertAccountMatch(accountId);

  const ab = await file.arrayBuffer();
  const bytes = new Uint8Array(ab);
  const shortHash = createHash("sha256")
    .update(bytes)
    .digest("hex")
    .slice(0, 16);

  const ext = inferExt((file as any).type ?? null, filename ?? null);
  const path = `${accountId}/materials/${materialId}-${shortHash}.${ext}`;

  const { error: upErr } = await supa.storage.from(bucket).upload(path, file, {
    cacheControl: "31536000",
    upsert: false,
    contentType: (file as any).type || "image/jpeg",
  });

  if (upErr) {
    if (isConflict(upErr)) {
      return {
        bucket,
        path,
        publicUrl: getPublicUrl(bucket, path),
        existed: true,
      };
    }
    throw upErr;
  }

  return {
    bucket,
    path,
    publicUrl: getPublicUrl(bucket, path),
    existed: false,
  };
}

/** Podpisywanie obiektu (gdy bucket prywatny) */
export async function signObject(
  bucket: string,
  path: string,
  expiresInSec = 900
): Promise<string> {
  // ✅ Guard: nie podpisujemy obcych accountów (path musi zaczynać się od {accountId}/...)
  await assertPathAccountMatch(path);

  const { data, error } = await supa.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSec);
  if (error) throw error;
  return data.signedUrl;
}
