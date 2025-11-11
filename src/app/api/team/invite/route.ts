// src/app/api/team/invite/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { supabaseServer } from '@/lib/supabaseServer';

const Body = z.object({
  email: z.string().email(),
  role: z.enum(['manager', 'storeman', 'worker']),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  phone: z.string().nullish(),
});

export async function POST(req: NextRequest) {
  try {
    const { email, role, first_name, last_name, phone } = Body.parse(await req.json());

    // 1) Autoryzacja — tylko manager może zapraszać
    const sb = await supabaseServer();

    const { data: appRole, error: roleErr } = await sb.rpc('current_app_role'); // user_role
    if (roleErr) throw roleErr;
    if (appRole !== 'manager') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    // account_id jest opcjonalne (single-tenant fallback)
    const { data: accountIdData, error: acctErr } = await sb.rpc('current_account_id');
    const accountId: string | null = acctErr ? null : ((accountIdData as string | null) ?? null);

    // 2) Admin client z Service Role (SERWER!)
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!url || !serviceKey) {
      return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 });
    }
    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 3) Wyślij zaproszenie — metadata: rola + profil + (opcjonalnie) account_id
    const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { role, first_name, last_name, phone, account_id: accountId ?? null },
      // redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/auth/callback`,
    });
    if (inviteErr) {
      return NextResponse.json({ error: inviteErr.message }, { status: 400 });
    }

    // 4) Wstępny wpis do team_members (BEZ user_id — tej kolumny nie ma)
    const upsertPayload = {
      first_name,
      last_name,
      phone: phone ?? null,
      role,
      email,
      invited_at: new Date().toISOString(),
      account_id: accountId ?? null,
    };
    const { error: tmErr } = await sb.from('team_members').insert([upsertPayload]);
    if (tmErr) {
      console.warn('team_members insert warn:', tmErr.message);
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'error' }, { status: 400 });
  }
}
