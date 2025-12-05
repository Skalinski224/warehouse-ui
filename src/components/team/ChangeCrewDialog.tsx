// src/components/team/ChangeCrewDialog.tsx
"use client";

import React from "react";

export type CrewOption = {
  id: string;
  name: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  crews: CrewOption[];
  currentCrewId: string | null;
  onSelect: (crewId: string | null) => Promise<void> | void;
  isSubmitting?: boolean;
};

export default function ChangeCrewDialog({
  open,
  onClose,
  crews,
  currentCrewId,
  onSelect,
  isSubmitting = false,
}: Props) {
  const [selectedId, setSelectedId] = React.useState<string | null>(currentCrewId);

  React.useEffect(() => {
    setSelectedId(currentCrewId);
  }, [currentCrewId, open]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSelect(selectedId);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-xl">
        <h2 className="text-sm font-semibold text-foreground">
          Zmień brygadę
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Wybierz brygadę, do której ma należeć ten członek zespołu.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div className="max-h-64 space-y-1 overflow-y-auto pr-1 text-sm">
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left ${
                selectedId === null
                  ? "bg-primary/10 text-primary border border-primary/40"
                  : "hover:bg-muted/60 border border-transparent text-foreground"
              }`}
            >
              <span>Brak brygady</span>
              {selectedId === null && (
                <span className="text-[11px] uppercase tracking-wide">
                  Aktualnie
                </span>
              )}
            </button>

            {crews.map((crew) => (
              <button
                key={crew.id}
                type="button"
                onClick={() => setSelectedId(crew.id)}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left ${
                  selectedId === crew.id
                    ? "bg-primary/10 text-primary border border-primary/40"
                    : "hover:bg-muted/60 border border-transparent text-foreground"
                }`}
              >
                <span>{crew.name}</span>
                {selectedId === crew.id && (
                  <span className="text-[11px] uppercase tracking-wide">
                    Aktualnie
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-3 text-sm">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-border px-3 py-1.5 hover:bg-muted/60 disabled:opacity-50"
            >
              Anuluj
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-primary px-3 py-1.5 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              Zapisz
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
