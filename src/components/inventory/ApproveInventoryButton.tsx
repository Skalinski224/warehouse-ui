// src/app/(app)/inventory/_components/ApproveInventoryButton.tsx
"use client";

import { useEffect, useState, useTransition } from "react";

export default function ApproveInventoryButton(props: {
  disabled?: boolean;
  onConfirm: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function confirm() {
    startTransition(async () => {
      try {
        await props.onConfirm();
        setOpen(false);
      } catch (e: any) {
        // ✅ Next.js redirect()/notFound() po stronie klienta wygląda jak "błąd"
        const digest = String(e?.digest ?? "");
        const msg = String(e?.message ?? "");

        const isNextRedirect =
          digest.includes("NEXT_REDIRECT") || msg.includes("NEXT_REDIRECT");
        const isNextNotFound =
          digest.includes("NEXT_NOT_FOUND") || msg.includes("NEXT_NOT_FOUND");

        if (isNextRedirect || isNextNotFound) {
          // traktujemy jako sukces nawigacji
          setOpen(false);
          return;
        }

        // prawdziwy błąd — zostawiamy (możesz tu podpiąć toast jeśli chcesz)
        throw e;
      }
    });
  }

  return (
    <>
      <button
        type="button"
        disabled={props.disabled}
        onClick={() => setOpen(true)}
        className="rounded-md border border-border px-4 py-2 text-xs disabled:opacity-40"
      >
        Potwierdź inwentaryzację
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-label="Potwierdzenie inwentaryzacji"
          onMouseDown={(e) => {
            // klik na tło zamyka modal
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-sm rounded-lg border border-border bg-card p-4 space-y-3">
            <h3 className="text-sm font-semibold">Zatwierdzić inwentaryzację?</h3>

            <p className="text-xs text-muted-foreground">
              Ta operacja <b>nadpisze stany magazynowe</b> na podstawie
              faktycznie policzonych ilości.
              <br />
              <br />
              <b>Nie można jej cofnąć.</b>
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={isPending}
                className="rounded-md border border-border px-3 py-2 text-xs disabled:opacity-50"
              >
                Anuluj
              </button>

              <button
                type="button"
                onClick={confirm}
                disabled={isPending}
                className="rounded-md border border-border bg-card px-3 py-2 text-xs font-medium disabled:opacity-50"
              >
                {isPending ? "Zatwierdzanie…" : "Tak, zatwierdź"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
