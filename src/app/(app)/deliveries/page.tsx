// src/app/(app)/deliveries/page.tsx
"use client";

import { useState } from "react";
import BackButton from "@/components/BackButton";
import NewDeliveryForm from "./_components/NewDeliveryForm";
import RoleGuard from "@/components/RoleGuard";
import { PERM } from "@/lib/permissions";
import GlobalToast from "@/components/GlobalToast";

function DeliveriesPageInner() {
  const [formOpen, setFormOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* ✅ globalny toast na tej stronie */}
      <GlobalToast />

      {/* HEADER + BACK */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2 min-w-0">
          <h1 className="text-2xl font-semibold">Nowe dostawy</h1>
          <p className="text-sm opacity-70">
            Dodaj dostawę. Po potwierdzeniu podsumowania zostanie od razu przyjęta do systemu.
          </p>
        </div>

        <div className="shrink-0 flex justify-end">
          <BackButton />
        </div>
      </header>

      {/* CENTRALNY CTA / FORM */}
      <RoleGuard allow={PERM.DELIVERIES_CREATE}>
        {!formOpen ? (
          <div className="flex justify-center">
            <button
              onClick={() => setFormOpen(true)}
              className="w-full max-w-xl py-5 sm:py-6 rounded-2xl border border-border bg-foreground text-background text-base font-medium hover:bg-foreground/90 transition"
            >
              + Dodaj nową dostawę
            </button>
          </div>
        ) : (
          <section className="max-w-3xl mx-auto rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h2 className="text-sm font-medium">Dodaj nową dostawę</h2>
                <p className="text-xs opacity-70">Wypełnij dane dostawy i zatwierdź podsumowanie.</p>
              </div>

              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="shrink-0 w-full sm:w-auto px-3 py-2 rounded border border-border bg-card hover:bg-card/80 text-sm transition"
              >
                Zamknij
              </button>
            </div>

            <NewDeliveryForm onDone={() => setFormOpen(false)} />
          </section>
        )}
      </RoleGuard>
    </div>
  );
}

export default function Page() {
  return (
    <RoleGuard allow={PERM.DELIVERIES_READ} silent>
      <DeliveriesPageInner />
    </RoleGuard>
  );
}