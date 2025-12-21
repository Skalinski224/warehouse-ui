// src/app/(app)/deliveries/page.tsx
"use client";

import { useState } from "react";
import NewDeliveryForm from "./_components/NewDeliveryForm";
import RoleGuard from "@/components/RoleGuard";
import { PERM } from "@/lib/permissions";

function DeliveriesPageInner() {
  const [formOpen, setFormOpen] = useState(false);

  return (
    <main className="p-6 space-y-6">
      {/* HEADER */}
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Nowe dostawy</h1>
        <p className="text-sm opacity-70">
          Dodaj dostawę. Po potwierdzeniu podsumowania zostanie od razu przyjęta
          do systemu.
        </p>
      </header>

      {/* CENTRALNY CTA / FORM */}
      <RoleGuard allow={PERM.DELIVERIES_CREATE}>
        {!formOpen ? (
          /* CTA */
          <div className="flex justify-center">
            <button
              onClick={() => setFormOpen(true)}
              className="w-full max-w-xl py-6 rounded-2xl border border-border bg-foreground text-background text-base font-medium hover:bg-foreground/90 transition"
            >
              + Dodaj nową dostawę
            </button>
          </div>
        ) : (
          /* FORM */
          <section className="max-w-3xl mx-auto rounded-2xl border border-border bg-card p-4 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-medium">Dodaj nową dostawę</h2>
                <p className="text-xs opacity-70">
                  Wypełnij dane dostawy i zatwierdź podsumowanie.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="shrink-0 px-3 py-2 rounded border border-border bg-card hover:bg-card/80 text-sm transition"
              >
                Zamknij
              </button>
            </div>

            {/* KLUCZ: po sukcesie formularz woła onDone -> wracamy do CTA */}
            <NewDeliveryForm onDone={() => setFormOpen(false)} />
          </section>
        )}
      </RoleGuard>
    </main>
  );
}

export default function Page() {
  // Dostęp tylko dla storeman / manager / owner
  return (
    <RoleGuard allow={PERM.DELIVERIES_READ} silent>
      <DeliveriesPageInner />
    </RoleGuard>
  );
}
