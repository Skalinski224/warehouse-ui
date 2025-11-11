'use client';

/**
 * Ten moduł jest wyłącznie dla kodu uruchamianego w przeglądarce.
 * Do Server Actions / API routes używaj: supabaseServer() z ./supabaseServer
 */

import { supabaseBrowser } from './supabaseBrowser';

/** Fabryka klienta Supabase do użycia w komponentach z 'use client'. */
export function supabaseClient() {
  // Dodatkowa asekuracja – w praktyce plik i tak jest client-only.
  if (typeof window === 'undefined') {
    throw new Error(
      'supabaseClient() wywołane po stronie serwera. Użyj supabaseServer() w kodzie serwerowym.'
    );
  }
  return supabaseBrowser();
}

// Re-eksport dla wygody (bez skutków ubocznych)
export { supabaseBrowser };

/* ⛔ USUNIĘTE:
export const supabase = typeof window !== 'undefined' ? ... : (() => { throw ... })();
To powodowało błąd przy samym imporcie modułu po stronie serwera.
*/
