// src/lib/supabaseServer.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function looksLikeUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s
  );
}

async function safeSelectAccountFromCookie(sb: any, cookieStore: any) {
  const accountId = cookieStore.get("wa-account-id")?.value ?? null;
  if (!accountId) return;

  // ✅ nie wołamy RPC na śmieciach
  if (!looksLikeUuid(accountId)) return;

  try {
    await sb.rpc("select_account", { p_account_id: accountId });
  } catch {
    // jeśli konto nie istnieje / brak członkostwa, UI powinno iść na wybór konta
  }
}

export async function supabaseServer() {
  const cookieStore = await cookies();

  const sb = createServerClient(
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
            cookieStore.set({ name, value, path: "/", ...options });
          } catch {
            // RSC – ignorujemy
          }
        },
        remove(name: string, options?: any) {
          try {
            cookieStore.set({ name, value: "", path: "/", maxAge: 0, ...options });
          } catch {
            // ignorujemy
          }
        },
      },
    }
  );

  await safeSelectAccountFromCookie(sb, cookieStore);
  return sb;
}