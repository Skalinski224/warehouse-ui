// src/app/(app)/settings/page.tsx
'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseBrowser } from '@/lib/supabaseClient';

const CODES = ['PLN', 'EUR', 'USD'] as const;

export default function SettingsPage() {
  const qc = useQueryClient();

  // Klient Supabase tylko w przeglądarce (ten plik jest client-only)
  const supabase = useMemo(() => supabaseBrowser(), []);

  const { data, isLoading, error } = useQuery({
    queryKey: ['app_settings', 'currency'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('id, currency_code')
        .limit(1)
        .single();
      if (error) throw error;
      return data as { id: string; currency_code: (typeof CODES)[number] };
    },
    staleTime: 60_000,
  });

  const [local, setLocal] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (newCode: string) => {
      // TODO: docelowo zrób upsert po stałym ID globalnych ustawień
      const { error } = await supabase
        .from('app_settings')
        .update({ currency_code: newCode })
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['app_settings', 'currency'] });
    },
  });

  if (isLoading) return <div className="p-6">Ładowanie…</div>;
  if (error) return <div className="p-6 text-rose-400">Błąd: {(error as any).message}</div>;

  const current = (local ?? data?.currency_code ?? 'PLN') as (typeof CODES)[number];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Ustawienia</h1>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3 max-w-md">
        <label className="text-sm text-white/70">Waluta raportów i kosztów</label>

        <select
          className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2"
          value={current}
          onChange={(e) => setLocal(e.target.value)}
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
          Aktualna w bazie: <b>{data?.currency_code}</b>
        </p>
      </div>
    </div>
  );
}
