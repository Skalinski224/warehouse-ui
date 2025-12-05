// src/lib/supabaseServer.ts

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Wersja zgodna z Next 15:
 * - cookies() jest async, więc supabaseServer też jest async
 * - wewnętrzne get/set/remove są już synchroniczne (korzystają z cookieStore)
 */
export async function supabaseServer() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          try {
            return cookieStore.get(name)?.value;
          } catch {
            return undefined;
          }
        },
        set(name: string, value: string, options?: any) {
          try {
            cookieStore.set({
              name,
              value,
              path: "/",
              ...options,
            });
          } catch {
            // RSC – ignorujemy
          }
        },
        remove(name: string, options?: any) {
          try {
            cookieStore.set({
              name,
              value: "",
              path: "/",
              maxAge: 0,
              ...options,
            });
          } catch {
            // ignorujemy
          }
        },
      },
    }
  );
}
