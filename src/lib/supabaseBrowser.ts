// src/lib/supabaseBrowser.ts
'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
// Jeśli masz wygenerowane typy bazy, odkomentuj to i podmień DB = Database
// import type { Database } from '@/lib/types';

// Typ bazy – podmień na swoje, gdy masz generowane typy
type DB = any; // albo: type DB = Database

let _client: SupabaseClient<DB> | null = null;

/**
 * Klient Supabase do komponentów klienckich (uploady, UI).
 * Singleton w module – jedna instancja na runtime przeglądarki.
 */
export function supabaseBrowser(): SupabaseClient<DB> {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error(
      'Brak NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY w środowisku.'
    );
  }

  _client = createBrowserClient<DB>(url, anon, {
    // W razie potrzeby dopnij custom fetch, np. z nagłówkami
    // global: { fetch },
  });

  return _client;
}
