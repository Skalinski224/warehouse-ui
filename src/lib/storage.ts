// /lib/storage.ts (server-only)
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // tylko po stronie serwera!

export async function signObject(bucket: string, path: string, expiresInSec = 900) {
  const supa = createClient(url, serviceKey);
  const { data, error } = await supa.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSec);
  if (error) throw error;
  return data.signedUrl;
}
