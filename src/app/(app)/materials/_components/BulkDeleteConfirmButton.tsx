// src/app/(app)/materials/_components/BulkDeleteConfirmButton.tsx
"use client";

import { useState } from "react";

export default function BulkDeleteConfirmButton({
  formId,
  disabled,
  countLabel = "zaznaczone materiały",
}: {
  formId: string;
  disabled?: boolean;
  countLabel?: string;
}) {
  const [open, setOpen] = useState(false);

  function submitForm() {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    // requestSubmit zachowuje walidacje i wywołuje server action jak normalny submit
    form.requestSubmit();
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="text-sm border border-red-500/60 text-red-200 rounded px-3 py-2 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-50 disabled:pointer-events-none"
      >
        Usuń zaznaczone
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* backdrop */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/60"
            aria-label="Zamknij"
          />

          {/* modal */}
          <div className="relative w-[520px] max-w-[92vw] rounded-2xl border border-border bg-card shadow-2xl p-6">
            <div className="text-base font-semibold">Usunąć {countLabel}?</div>

            <div className="mt-3 text-sm opacity-80 space-y-2">
              <div>Ta operacja przeniesie materiały do „Usunięte”.</div>
              <div>Można ją cofnąć w stan: Usunięte.</div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-3 py-2 rounded border border-border bg-card hover:bg-card/80 text-sm transition"
              >
                Anuluj
              </button>

              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  submitForm();
                }}
                className="px-3 py-2 rounded border border-red-500/60 text-red-200 bg-red-500/10 hover:bg-red-500/20 text-sm transition"
              >
                Tak, usuń
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
