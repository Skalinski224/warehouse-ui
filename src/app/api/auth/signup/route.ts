// src/app/api/auth/signup/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

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

  if (!PASSWORD_REGEX.test(password)) {
    return NextResponse.json(
      { ok: false, error: "Hasło: min. 8 znaków, 1 mała litera, 1 duża litera, 1 cyfra, 1 znak specjalny." },
      { status: 400 }
    );
  }

  const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const { error } = await supa.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${site}/auth/callback`,
      // ❗️NIE ustawiaj tu managera.
      // Jeśli masz “signup tworzy nowe konto = owner”, ustaw OWNER (albo zostaw puste i niech backend ustali):
      // data: { role: "owner" },
    },
  });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
