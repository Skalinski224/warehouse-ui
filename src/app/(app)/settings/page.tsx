'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseBrowser } from '@/lib/supabaseClient';
import { PERM, can, type PermissionSnapshot } from '@/lib/permissions';

const CODES = ['PLN', 'EUR', 'USD'] as const;
type Code = (typeof CODES)[number];

export default function SettingsPage() {
  const qc = useQueryClient();
  const supabase = useMemo(() => supabaseBrowser(), []);

  // 1) Snapshot permissions (źródło prawdy dla gate’ów)
  const {
    data: snap,
    isLoading: snapLoading,
    error: snapError,
  } = useQuery({
    queryKey: ['my_permissions_snapshot'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_permissions_snapshot');
      if (error) throw error;
      // DB zwraca jeden rekord (lub null)
      return (data ?? null) as PermissionSnapshot | null;
    },
    staleTime: 30_000,
  });

  const canManageSettings = can(snap, PERM.PROJECT_SETTINGS_MANAGE);

  // 2) Jeśli nie-owner → nie pokazujemy ustawień w ogóle
  if (snapLoading) return <div className="p-6">Ładowanie…</div>;
  if (snapError) return <div className="p-6 text-rose-400">Błąd: {(snapError as any).message}</div>;
  if (!canManageSettings) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm text-white/80">Brak dostępu.</div>
          <div className="text-xs text-white/50 mt-1">
            Ustawienia są dostępne tylko dla właściciela konta (owner).
          </div>
        </div>
      </div>
    );
  }

  // 3) Dopiero owner odpala pobieranie waluty
  const { data, isLoading, error } = useQuery({
    queryKey: ['account_settings', 'currency'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('current_currency_code');
      if (error) throw error;
      return (data ?? 'PLN') as Code;
    },
    staleTime: 60_000,
  });

  const [local, setLocal] = useState<Code | null>(null);

  const mutation = useMutation({
    mutationFn: async (newCode: Code) => {
      const { error } = await supabase.rpc('set_current_currency_code', { p_code: newCode });
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['account_settings', 'currency'] });
    },
  });

  if (isLoading) return <div className="p-6">Ładowanie…</div>;
  if (error) return <div className="p-6 text-rose-400">Błąd: {(error as any).message}</div>;

  const current: Code = (local ?? data ?? 'PLN') as Code;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Ustawienia</h1>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3 max-w-md">
        <label className="text-sm text-white/70">Waluta raportów i kosztów</label>

        <select
          className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2"
          value={current}
          onChange={(e) => setLocal(e.target.value as Code)}
        >
          {CODES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <button
          onClick={() => mutation.mutate(current)}
          disabled={mutation.isPending}
          className="rounded-lg bg-white/10 hover:bg-white/15 px-3 py-2 text-sm"
        >
          {mutation.isPending ? 'Zapisywanie…' : 'Zapisz'}
        </button>

        <p className="text-xs text-white/50">
          Aktualna w bazie: <b>{data}</b>
        </p>
      </div>
    </div>
  );
}
