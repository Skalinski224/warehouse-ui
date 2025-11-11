// src/app/api/auth/signup/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  const { email, password } = await req.json();

  const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  const { error } = await supa.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${site}/auth/callback`,
      data: { role: 'manager' },
    },
  });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
