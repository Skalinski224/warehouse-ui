// src/components/object/PlaceForm.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { createPlace } from "@/app/(app)/object/actions";

type Props = {
  parentId: string | null;
  triggerLabel?: string;
};

export default function PlaceForm({ parentId, triggerLabel = "+ Dodaj miejsce" }: Props) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const nameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    const t = setTimeout(() => nameRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function close() {
    if (submitting) return;
    setOpen(false);
  }

  async function onSubmit(formData: FormData) {
    setSubmitting(true);
    setErr(null);
    try {
      await createPlace(formData);
      setOpen(false);
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || "Nie udało się dodać miejsca.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center rounded-xl border border-border/70 bg-card/60 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-card/80 transition"
      >
        {triggerLabel}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          onMouseDown={(e) => {
            // klik w tło zamyka
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="w-full max-w-xl rounded-2xl border border-border/70 bg-card/90 shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-foreground">Nowe miejsce</div>
                <div className="text-xs text-muted-foreground">
                  Dodaj miejsce w strukturze obiektu{parentId ? " (pod-miejsce)" : ""}.
                </div>
              </div>

              <button
                type="button"
                onClick={close}
                className="rounded-xl border border-border/70 bg-background/40 px-3 py-2 text-xs hover:bg-background/60 disabled:opacity-60"
                disabled={submitting}
              >
                Zamknij
              </button>
            </div>

            <form action={onSubmit} className="px-5 py-4 space-y-3">
              <input type="hidden" name="parent_id" value={parentId ?? ""} />

              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1 md:col-span-2">
                  <div className="text-[11px] text-muted-foreground">Nazwa miejsca *</div>
                  <input
                    ref={nameRef}
                    name="name"
                    required
                    placeholder="Np. Rozdzielnia A"
                    className="w-full rounded-xl border border-border/70 bg-background/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/15"
                    disabled={submitting}
                  />
                </label>

                <label className="space-y-1 md:col-span-2">
                  <div className="text-[11px] text-muted-foreground">Opis (opcjonalnie)</div>
                  <textarea
                    name="description"
                    rows={3}
                    placeholder="Krótki opis miejsca, np. poziom, przeznaczenie…"
                    className="w-full resize-none rounded-xl border border-border/70 bg-background/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/15"
                    disabled={submitting}
                  />
                </label>
              </div>

              {err ? (
                <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                  {err}
                </div>
              ) : null}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={close}
                  className="rounded-xl border border-border/70 bg-background/40 px-3 py-2 text-xs hover:bg-background/60 disabled:opacity-60"
                  disabled={submitting}
                >
                  Anuluj
                </button>

                <button
                  type="submit"
                  className="rounded-xl border border-border/70 bg-foreground/15 px-3 py-2 text-xs font-semibold hover:bg-foreground/20 disabled:opacity-60"
                  disabled={submitting}
                >
                  {submitting ? "Zapisuję…" : "Zapisz"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
