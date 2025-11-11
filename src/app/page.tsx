'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import Sidebar from '@/components/Sidebar';

type Material = {
  name: string | null;
  base_quantity: number | null;
  current_quantity: number | null;
};

export default function Dashboard() {
  const supabase = supabaseBrowser();

  // undefined = trwa weryfikacja; null = brak sesji; Session = zalogowany
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [error, setError] = useState<string | null>(null);

  // 1) sprawdzenie/śledzenie sesji
  useEffect(() => {
    let ignore = false;

    supabase.auth.getSession().then(({ data }) => {
      if (!ignore) setSession(data.session ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_ev, s) => {
      setSession(s ?? null);
    });

    return () => {
      ignore = true;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) pobranie danych po zalogowaniu
  useEffect(() => {
    if (!session) return;
    (async () => {
      const { data, error } = await supabase
        .from('materials')
        .select('name, base_quantity, current_quantity')
        .order('name');
      if (error) setError(error.message);
      else setMaterials(data || []);
    })();
  }, [session, supabase]);

  // Ekran weryfikacji
  if (session === undefined) {
    return (
      <main className="flex min-h-screen items-center justify-center text-foreground/70">
        Trwa weryfikacja sesji…
      </main>
    );
  }

  // Niezalogowany → link do logowania
  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Link
          href="/login?redirect=/"
          className="rounded border px-4 py-2 hover:bg-foreground/10"
        >
          Zaloguj się
        </Link>
      </main>
    );
  }

  // Zalogowany – normalny layout z Sidebar
  const cards = [
    { href: '/low-stock', title: 'Co się kończy', desc: 'Lista pozycji < 25% stanu' },
    { href: '/deliveries', title: 'Nowe dostawy', desc: 'Dodaj / zatwierdź przyjęcia' },
    { href: '/reports', title: 'Raporty', desc: 'Podsumowania i eksporty' },
  ];

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6 space-y-6">
        {/* Nagłówek */}
        <div className="flex items-start justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <span className="rounded-lg bg-foreground/[0.08] px-2 py-1 text-sm">
            {session.user.email}
          </span>
        </div>

        {/* Szybkie akcje */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase text-foreground/60">Szybkie akcje</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {cards.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                className="group relative block rounded-2xl border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:border-foreground/20 hover:bg-foreground/[0.06] hover:shadow-xl hover:shadow-black/40"
              >
                <div className="text-base font-semibold">{c.title}</div>
                <div className="mt-1 text-sm text-foreground/70">{c.desc}</div>
              </Link>
            ))}
          </div>
        </section>

        {/* Placeholder AI */}
        <div className="rounded-2xl border border-border bg-card p-5 text-foreground/70">
          Ekran główny to będzie chat z AI (dodamy później).
        </div>

        {/* Podgląd materiałów */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase text-foreground/60">
            Szybki podgląd materiałów
          </h2>

          {error ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
              DB error: {error}
            </div>
          ) : materials.length > 0 ? (
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {materials.map((m) => (
                <li key={String(m.name)} className="rounded-xl border border-border bg-card p-4">
                  <div className="font-medium">{m.name ?? '—'}</div>
                  <div className="mt-1 text-sm text-foreground/70">
                    baza: {m.base_quantity ?? 0} &nbsp;|&nbsp; stan: {m.current_quantity ?? 0}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-foreground/70">Brak danych do wyświetlenia.</p>
          )}
        </section>
      </main>
    </div>
  );
}
