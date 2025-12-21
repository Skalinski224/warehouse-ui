import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function normEmail(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const e = v.trim().toLowerCase();
  if (!e || !e.includes("@")) return null;
  return e;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = normEmail(body?.email);
  const password = typeof body?.password === "string" ? body.password : null;

  if (!email || !password) {
    return NextResponse.json({ ok: false, error: "Brak email lub hasła" }, { status: 400 });
  }

  const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data, error } = await supa.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    return NextResponse.json({ ok: false, error: error?.message || "Błąd logowania" }, { status: 400 });
  }

  // ustaw cookie jak w /api/auth/sync
  const s = data.session;
  const now = Math.floor(Date.now() / 1000);
  const maxAgeAccess = Math.max(1, (s.expires_at ?? now + 3600) - now);
  const secure = process.env.NODE_ENV === "production";

  const res = NextResponse.json({ ok: true });

  res.cookies.set({
    name: "sb-access-token",
    value: s.access_token,
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: maxAgeAccess,
  });

  res.cookies.set({
    name: "sb-refresh-token",
    value: s.refresh_token,
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return res;
}
