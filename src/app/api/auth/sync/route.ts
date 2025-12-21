// src/app/api/auth/sync/route.ts
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  const { access_token, refresh_token, pw_required } = await req.json().catch(() => ({}));

  if (!access_token || !refresh_token) {
    return NextResponse.json({ ok: false, reason: "missing tokens" }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true });
  res.headers.set("cache-control", "no-store");

  const cookieStore = await cookies();

  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          try {
            return res.cookies.get(name)?.value ?? cookieStore.get(name)?.value;
          } catch {
            return undefined;
          }
        },
        set(name: string, value: string, options?: any) {
          try {
            res.cookies.set({ name, value, path: "/", ...options });
          } catch {}
        },
        remove(name: string, options?: any) {
          try {
            res.cookies.set({ name, value: "", path: "/", maxAge: 0, ...options });
          } catch {}
        },
      },
    }
  );

  // Ustawia cookies w formacie Supabase SSR (to jest klucz)
  const { error } = await sb.auth.setSession({ access_token, refresh_token });
  if (error) {
    return NextResponse.json({ ok: false, reason: error.message }, { status: 400 });
  }

  // Gate: wymuszenie hasła (HttpOnly)
  if (pw_required === true) {
    res.cookies.set({
      name: "pw-required",
      value: "1",
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 2,
    });
  } else if (pw_required === false) {
    res.cookies.set({
      name: "pw-required",
      value: "",
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }

  // Legacy cleanup (na wypadek starych buildów)
  res.cookies.set({ name: "sb-access-token", value: "", path: "/", maxAge: 0 });
  res.cookies.set({ name: "sb-refresh-token", value: "", path: "/", maxAge: 0 });

  return res;
}
