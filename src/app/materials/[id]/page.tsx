import Image from 'next/image';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic'; // pewność świeżych danych w dev

type Material = {
  id: string;
  name: string;
  description?: string | null;
  base_quantity: number | null;
  current_quantity: number | null;
  unit: string | null;
  image_url: string | null;
  created_at?: string | null;
};

export default async function MaterialDetail({
  params,
}: {
  params: { id: string };
}) {
  const { data, error } = await supabase
    .from('materials')
    .select('id,name,description,base_quantity,current_quantity,unit,image_url,created_at')
    .eq('id', params.id)
    .single();

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Materiał</h1>
        <p className="text-red-400">Błąd pobierania: {error.message}</p>
        <Link href="/materials" className="text-sm underline underline-offset-4">
          ← Wróć do listy
        </Link>
      </div>
    );
  }

  const m = (data ?? {}) as Material;
  const base = m.base_quantity ?? 0;
  const current = m.current_quantity ?? 0;
  const ratio = base > 0 ? Math.min(100, Math.max(0, (current / base) * 100)) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{m.name}</h1>
          <p className="text-sm text-white/60">
            {m.unit ? `Jednostka: ${m.unit}` : 'Jednostka: —'}
          </p>
          {m.created_at && (
            <p className="text-xs text-white/40 mt-1">
              Dodano: {new Date(m.created_at).toLocaleString()}
            </p>
          )}
        </div>

        <Link
          href="/materials"
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:border-white/20 hover:bg-white/10"
        >
          ← Wróć
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="mb-3 h-64 w-full overflow-hidden rounded-xl bg-black/20">
            {m.image_url ? (
              <Image
                src={m.image_url}
                alt={m.name}
                width={900}
                height={600}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-white/40">
                brak miniatury
              </div>
            )}
          </div>

          <div>
            <p className="text-sm text-white/70">
              Stan: <span className="font-medium text-white">{current}</span>
              {base ? (
                <>
                  {' '}
                  / <span className="text-white/70">{base}</span>
                </>
              ) : null}
            </p>
            {base > 0 && (
              <div className="mt-2 h-2 w-full rounded-full bg-white/10">
                <div
                  className={`h-2 rounded-full ${
                    ratio < 25 ? 'bg-red-500' : ratio < 50 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${ratio}%` }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h2 className="mb-2 text-lg font-semibold">Opis</h2>
            <p className="text-white/70 text-sm leading-relaxed">
              {m.description?.trim() || 'Brak opisu.'}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h2 className="mb-2 text-lg font-semibold">Akcje (placeholder)</h2>
            <div className="flex flex-wrap gap-2">
              <button className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:border-white/20 hover:bg-white/10">
                Usuń
              </button>
              <button className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:border-white/20 hover:bg-white/10">
                Przywróć
              </button>
              <button className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:border-white/20 hover:bg-white/10">
                Otwórz CTA
              </button>
            </div>
            <p className="mt-2 text-xs text-white/50">
              (Akcje będą „ożywione” w kolejnych punktach.)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
