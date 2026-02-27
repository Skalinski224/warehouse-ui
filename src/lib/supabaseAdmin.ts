// src/lib/supabaseAdmin.ts
import "server-only";

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
}
if (!serviceRoleKey) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
}

// UWAGA: tego clienta używamy TYLKO po stronie serwera!
export function supabaseAdmin() {
  return createClient(url as string, serviceRoleKey as string, {
    auth: {
      persistSession: false,
    },
  });
}