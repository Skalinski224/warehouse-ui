// src/lib/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabaseServer';

/* --------------------------- POMOCNICZE --------------------------- */

async function db() {
  // klient Supabase powiązany z cookie (sb-access-token) bieżącego requestu
  return await supabaseServer();
}

function refresh(paths: string[]) {
  for (const p of paths) revalidatePath(p);
}

/* ===================== DOSTAWY / RAPORTY (RPC) ==================== */

/**
 * Akceptacja dostawy:
 * - RPC: add_delivery_and_update_stock(delivery_id uuid)
 * - Podnosi stany w `materials`, ustawia `deliveries.approved = true`
 * - Rewaliduje listy i miejsca, gdzie widać stan/koszty
 */
export async function approveDelivery(formData: FormData): Promise<void> {
  const id = String(formData.get('delivery_id') ?? '').trim();
  if (!id) {
    console.error('approveDelivery: brak delivery_id');
    return;
  }

  const supabase = await db();
  const { error } = await supabase.rpc('add_delivery_and_update_stock', { delivery_id: id });

  if (error) {
    console.error('approveDelivery RPC error:', error);
    return;
  }

  refresh([
    '/deliveries',
    '/reports/deliveries',
    '/low-stock',
    '/materials',
    '/reports/project-metrics',
    '/reports/plan-vs-reality',
  ]);
}

/**
 * Akceptacja raportu dziennego zużycia:
 * - RPC: subtract_usage_and_update_stock(report_id uuid)
 * - Obniża stany w `materials`, ustawia `daily_reports.approved = true`
 * - Rewaliduje listy i ekrany zależne od stanów
 */
export async function approveDailyReport(formData: FormData): Promise<void> {
  const id = String(formData.get('report_id') ?? '').trim();
  if (!id) {
    console.error('approveDailyReport: brak report_id');
    return;
  }

  const supabase = await db();
  const { error } = await supabase.rpc('subtract_usage_and_update_stock', { report_id: id });

  if (error) {
    console.error('approveDailyReport RPC error:', error);
    return;
  }

  refresh([
    '/reports/daily',
    '/low-stock',
    '/materials',
    '/reports/project-metrics',
    '/reports/plan-vs-reality',
  ]);
}

/* ============================ ZESPÓŁ ============================== */

export async function addTeamMember(formData: FormData) {
  const first_name = String(formData.get('first_name') || '').trim();
  const last_name  = String(formData.get('last_name')  || '').trim();
  const phone      = (String(formData.get('phone') || '').trim()) || null;
  const email      = (String(formData.get('email') || '').trim()) || null;
  const role       = String(formData.get('role') || 'worker');

  if (!first_name || !last_name) return { ok: false, error: 'Imię i nazwisko są wymagane' };

  const supabase = await db();
  const { error } = await supabase
    .from('team_members')
    .insert([{ first_name, last_name, phone, email, role }]);

  if (error) return { ok: false, error: error.message };

  refresh(['/team']);
  return { ok: true };
}

export async function updateTeamMember(formData: FormData) {
  const id         = String(formData.get('id') || '').trim();
  const first_name = String(formData.get('first_name') || '').trim();
  const last_name  = String(formData.get('last_name')  || '').trim();
  const phone      = (String(formData.get('phone') || '').trim()) || null;
  const email      = (String(formData.get('email') || '').trim()) || null;
  const role       = String(formData.get('role') || 'worker');

  if (!id) return { ok: false, error: 'Brak ID' };

  const supabase = await db();
  const { error } = await supabase
    .from('team_members')
    .update({ first_name, last_name, phone, email, role })
    .eq('id', id);

  if (error) return { ok: false, error: error.message };

  refresh(['/team']);
  return { ok: true };
}

export async function softDeleteMember(formData: FormData) {
  const id = String(formData.get('id') || '').trim();
  if (!id) return { ok: false, error: 'Brak ID' };

  const supabase = await db();
  const { error } = await supabase
    .from('team_members')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return { ok: false, error: error.message };

  refresh(['/team']);
  return { ok: true };
}

export async function addCrew(formData: FormData) {
  const name = String(formData.get('crew_name') || '').trim();
  if (!name) return { ok: false, error: 'Nazwa brygady jest wymagana' };

  const supabase = await db();
  const { error } = await supabase.from('crews').insert([{ name }]);
  if (error) return { ok: false, error: error.message };

  refresh(['/team']);
  return { ok: true };
}

export async function assignToCrew(formData: FormData) {
  const crew_id   = String(formData.get('crew_id')   || '').trim();
  const member_id = String(formData.get('member_id') || '').trim();
  if (!crew_id || !member_id) return { ok: false, error: 'Brak crew_id/member_id' };

  const supabase = await db();
  const { error } = await supabase.from('crew_members').upsert([{ crew_id, member_id }]);
  if (error) return { ok: false, error: error.message };

  refresh(['/team']);
  return { ok: true };
}

export async function removeFromCrew(formData: FormData) {
  const crew_id   = String(formData.get('crew_id')   || '').trim();
  const member_id = String(formData.get('member_id') || '').trim();
  if (!crew_id || !member_id) return { ok: false, error: 'Brak crew_id/member_id' };

  const supabase = await db();
  const { error } = await supabase.from('crew_members').delete().match({ crew_id, member_id });
  if (error) return { ok: false, error: error.message };

  refresh(['/team']);
  return { ok: true };
}

/** PLACEHOLDER – zmiana hasła (UI-only). W realu pójdzie przez Auth API / reset link. */
export async function requestPasswordReset(_formData: FormData) {
  return { ok: true };
}

/* ======================= OBIEKT / MIEJSCA ========================= */

export async function addPlace(formData: FormData): Promise<void> {
  const name = String(formData.get('name') || '').trim();
  const description = (String(formData.get('description') || '').trim()) || null;
  if (!name) return;

  const supabase = await db();
  const { error } = await supabase.from('project_places').insert([{ name, description }]);
  if (error) { console.error('addPlace', error); return; }

  refresh(['/object', '/reports/daily']);
}

export async function updatePlace(formData: FormData): Promise<void> {
  const id = String(formData.get('id') || '').trim();
  const name = String(formData.get('name') || '').trim();
  const description = (String(formData.get('description') || '').trim()) || null;
  if (!id || !name) return;

  const supabase = await db();
  const { error } = await supabase.from('project_places').update({ name, description }).eq('id', id);
  if (error) { console.error('updatePlace', error); return; }

  refresh(['/object', '/reports/daily']);
}

export async function deletePlace(formData: FormData): Promise<void> {
  const id = String(formData.get('id') || '').trim();
  if (!id) return;

  const supabase = await db();
  const { error } = await supabase
    .from('project_places')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) { console.error('deletePlace', error); return; }

  refresh(['/object', '/reports/daily', '/reports/plan-vs-reality']);
}

/* ===================== PLANY PROJEKTANTA ========================== */

export async function addDesignerPlan(formData: FormData): Promise<void> {
  const family_key = String(formData.get('family_key') || '').trim();
  const planned_qty = Number(formData.get('planned_qty') || 0);
  const planned_cost = Number(formData.get('planned_cost') || 0);
  const planned_unit_price_raw = formData.get('planned_unit_price'); // opcjonalne
  const planned_unit_price =
    planned_unit_price_raw !== null &&
    planned_unit_price_raw !== undefined &&
    String(planned_unit_price_raw).trim() !== ''
      ? Number(planned_unit_price_raw)
      : null;

  const stage_id = (String(formData.get('stage_id') || '').trim()) || null;
  const place_id = (String(formData.get('place_id') || '').trim()) || null;

  if (!family_key) return;

  const payload: Record<string, unknown> = { family_key, planned_qty, planned_cost, stage_id, place_id };
  if (planned_unit_price !== null && !Number.isNaN(planned_unit_price)) {
    payload.planned_unit_price = planned_unit_price; // jeśli kolumna istnieje – zostanie zapisana
  }

  const supabase = await db();
  const { error } = await supabase.from('designer_plans').insert([payload]);
  if (error) { console.error('addDesignerPlan', error); return; }

  refresh(['/object', '/reports/plan-vs-reality']);
}

export async function deleteDesignerPlan(formData: FormData): Promise<void> {
  const id = String(formData.get('id') || '').trim();
  if (!id) return;

  const supabase = await db();
  const { error } = await supabase.from('designer_plans').delete().eq('id', id);
  if (error) { console.error('deleteDesignerPlan', error); return; }

  refresh(['/object', '/reports/plan-vs-reality']);
}
