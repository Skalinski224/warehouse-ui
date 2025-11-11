'use server';

import { createClient } from '@supabase/supabase-js';
import { supabaseServer } from '@/lib/supabaseServer';

type Role = 'manager'|'storeman'|'worker';

export async function inviteUser(email: string, role: Role) {
  // 1) Tenant bieżącego PM
  const supa = await supabaseServer();
  const { data: account, error: acctErr } = await supa.rpc('current_account_id');
  if (acctErr) throw acctErr;
  if (!account) throw new Error('Brak account_id dla bieżącego użytkownika');

  // 2) Service role (admin) wysyła invite z metadanymi
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { role, account_id: account }
  });

  if (error) throw error;
  return { ok: true, userId: data?.user?.id ?? null };
}
