"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type Material = {
  id: string;
  title: string | null;
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
        .from("materials")
        .select("id, title, base_quantity, current_quantity")
        .order("title");

      if (error) {
        setError(error.message);
      } else {
        setMaterials((data ?? []) as Material[]);
      }
    })();
  }, [session, supabase]);

  // Ekran weryfikacji
  if (session === undefined) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground/70">
        Trwa weryfikacja sesji…
      </main>
    );
  }

  // Niezalogowany → link do logowania
  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Link
          href="/login?redirect=/"
          className="rounded-xl border border-border bg-card px-5 py-3 text-sm font-medium text-foreground shadow-sm transition hover:-translate-y-0.5 hover:border-foreground/30 hover:bg-foreground/[0.06] hover:shadow-xl hover:shadow-black/40"
        >
          Zaloguj się, aby zobaczyć dashboard
        </Link>
      </main>
    );
  }

  const cards = [
    {
      href: "/low-stock",
      title: "Co się kończy",
      desc: "Materiały poniżej 25% stanu początkowego.",
    },
    {
      href: "/deliveries",
      title: "Nowe dostawy",
      desc: "Dodawaj i zatwierdzaj przyjęcia materiałów.",
    },
    {
      href: "/reports",
      title: "Raporty",
      desc: "Podsumowania kosztów, zużyć i etapów projektu.",
    },
  ];

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground md:px-8 md:py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        {/* Pasek górny */}
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Dashboard
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Szybki przegląd magazynu i najważniejszych akcji w projekcie.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-card/70 px-3 py-2 text-xs text-muted-foreground shadow-sm">
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            <div className="flex flex-col">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground/70">
                Zalogowany użytkownik
              </span>
              <span className="text-xs font-medium text-foreground">
                {session.user.email}
              </span>
            </div>
          </div>
        </header>

        {/* Szybkie akcje */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase text-foreground/60">
            Szybkie akcje
          </h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {cards.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                className="group relative block rounded-2xl border border-border bg-card/80 p-5 transition hover:-translate-y-0.5 hover:border-foreground/20 hover:bg-foreground/[0.05] hover:shadow-xl hover:shadow-black/40"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold text-foreground">
                      {c.title}
                    </div>
                    <div className="mt-1 text-sm text-foreground/70">
                      {c.desc}
                    </div>
                  </div>
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/70 text-xs text-muted-foreground transition group-hover:border-foreground/50 group-hover:text-foreground">
                    →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Placeholder AI */}
        <section className="rounded-2xl border border-dashed border-border bg-card/60 p-5 text-sm text-foreground/70">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-foreground/60">
            Asystent AI (w przygotowaniu)
          </div>
          <p>
            Tutaj pojawi się chat z AI, który pozwoli zadawać pytania o
            magazyn, koszty i postęp prac w naturalnym języku.
          </p>
        </section>

        {/* Podgląd materiałów */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase text-foreground/60">
              Szybki podgląd materiałów
            </h2>
            <Link
              href="/materials"
              className="text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              Przejdź do pełnej listy
            </Link>
          </div>

          {error ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
              DB error: {error}
            </div>
          ) : materials.length > 0 ? (
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {materials.map((m) => {
                const base = m.base_quantity ?? 0;
                const current = m.current_quantity ?? 0;
                const pct =
                  base > 0 ? Math.round((current / base) * 100) : null;
                const safePct = Math.min(Math.max(pct ?? 0, 0), 150);

                const isLow = pct !== null && pct <= 25;

                return (
                  <li
                    key={m.id}
                    className="rounded-xl border border-border bg-card p-4 text-sm shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium text-foreground">
                          {m.title ?? "Bez nazwy"}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          baza: {base} &nbsp;|&nbsp; stan: {current}
                        </div>
                      </div>
                      {isLow && (
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-400">
                          Mało
                        </span>
                      )}
                    </div>

                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>Poziom zapasu</span>
                        <span>{pct !== null ? `${pct}%` : "—"}</span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-foreground/[0.08]">
                        <div
                          className={`h-2 rounded-full ${
                            isLow
                              ? "bg-amber-400"
                              : "bg-emerald-500"
                          }`}
                          style={{ width: `${safePct}%` }}
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-foreground/70">
              Brak danych do wyświetlenia. Dodaj pierwszy materiał lub dostawę.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
