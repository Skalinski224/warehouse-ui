import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabaseServer';

const PatchBody = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  phone: z.string().nullish(),
  role: z.enum(['manager', 'storeman', 'worker']),
});

export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const id = ctx.params.id;
    const { first_name, last_name, phone, role } = PatchBody.parse(await req.json());

    const sb = await supabaseServer();
    const { data: appRole, error: roleErr } = await sb.rpc('current_app_role');
    if (roleErr) throw roleErr;
    if (appRole !== 'manager') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const { error } = await sb
      .from('team_members')
      .update({ first_name, last_name, phone: phone ?? null, role })
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'error' }, { status: 400 });
  }
}
