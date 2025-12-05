// src/components/object/PlaceForm.tsx
"use client";

import { useState } from "react";
import { createPlace } from "@/app/(app)/object/actions";

type Props = {
  parentId: string | null;
};

export default function PlaceForm({ parentId }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center gap-2">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center rounded-lg border border-border px-3 py-1.5 text-xs font-medium bg-card hover:bg-card/80 transition"
        >
          + Dodaj miejsce
        </button>
      ) : (
        <div className="border border-border rounded-xl bg-card/70 px-3 py-3 space-y-2 min-w-[260px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-foreground/80">
              Nowe miejsce
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[11px] text-foreground/60 hover:text-foreground"
            >
              Anuluj
            </button>
          </div>

          <form
            action={async (formData) => {
              try {
                await createPlace(formData);
                setOpen(false);
              } catch (e) {
                console.error(e);
                // opcjonalnie: dodać local error state
              }
            }}
            className="space-y-2"
          >
            <input
              type="hidden"
              name="parent_id"
              value={parentId ?? ""}
            />

            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-foreground/70">
                Nazwa miejsca *
              </label>
              <input
                name="name"
                required
                placeholder="Np. Rozdzielnia A"
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-foreground/40"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-foreground/70">
                Opis (opcjonalnie)
              </label>
              <textarea
                name="description"
                placeholder="Krótki opis miejsca, np. poziom, przeznaczenie..."
                rows={2}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-foreground/40 resize-none"
              />
            </div>

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center rounded-md bg-foreground text-background text-xs font-semibold px-3 py-1.5 hover:bg-foreground/90 transition"
            >
              Zapisz miejsce
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
