'use client';

import { createBrowserClient } from '@supabase/ssr';

// Klient przeglądarkowy — używany we wszystkich komponentach client-side
export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
