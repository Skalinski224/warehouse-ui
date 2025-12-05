// src/lib/storage.ts
"use server";
import "server-only";

import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

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
  const { data, error } = await supa.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSec);
  if (error) throw error;
  return data.signedUrl;
}
