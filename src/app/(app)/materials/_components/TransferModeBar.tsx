// src/app/(app)/materials/_components/TransferModeBar.tsx
"use client";

import { useMemo, useState } from "react";
import { useTransferMode } from "@/app/(app)/materials/_components/TransferModeContext";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export default function TransferModeBar() {
  const { enabled, setEnabled, target, setTarget, locations } = useTransferMode();
  const [pickOpen, setPickOpen] = useState(false);
  const [picked, setPicked] = useState<string>("");

  const opts = useMemo(() => {
    return (locations ?? []).map((l) => ({ id: String(l.id), label: String(l.label) }));
  }, [locations]);

  function openPick() {
    setPicked(target?.to_location_id ?? "");
    setPickOpen(true);
  }

  function confirmPick() {
    const id = picked.trim();
    const found = opts.find((x) => x.id === id) || null;
    if (!found) return;
    setTarget({ to_location_id: found.id, to_location_label: found.label });
    setEnabled(true);
    setPickOpen(false);
  }

  function endMode() {
    setEnabled(false);
    setTarget(null);
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs opacity-70">
          {enabled && target ? (
            <>
              Tryb transferu: <span className="font-medium">{target.to_location_label}</span> (klikaj materiały, żeby
              przenosić)
            </>
          ) : (
            <>Możesz uruchomić tryb transferu i przenosić stany między lokalizacjami.</>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!enabled ? (
            <button
              type="button"
              onClick={openPick}
              className={cx(
                "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium",
                "border-emerald-500/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/20"
              )}
            >
              Transfer
            </button>
          ) : (
            <button
              type="button"
              onClick={endMode}
              className={cx(
                "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium",
                "border-border bg-card hover:bg-background/10"
              )}
            >
              Zakończ transfer
            </button>
          )}
        </div>
      </div>

      {pickOpen ? (
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/60" onClick={() => setPickOpen(false)} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-xl rounded-2xl border border-border bg-card shadow-2xl">
              <div className="flex items-start justify-between gap-3 p-5">
                <div>
                  <div className="text-base font-semibold">Tryb transferu</div>
                  <div className="mt-1 text-sm opacity-80">
                    Wybierz lokację docelową. Potem klikaj materiały — pojawi się okno przeniesienia.
                  </div>
                </div>
                <button
                  type="button"
                  className="rounded-md border border-border bg-background/20 px-3 py-2 text-xs hover:bg-background/30"
                  onClick={() => setPickOpen(false)}
                >
                  Zamknij
                </button>
              </div>

              <div className="px-5 pb-5">
                <div className="rounded-2xl border border-border bg-background/20 p-4">
                  <div className="text-sm font-medium">Lokalizacja docelowa *</div>
                  <div className="mt-2">
                    <select
                      className="w-full rounded-md border border-border bg-background/40 px-3 py-2 text-sm"
                      value={picked}
                      onChange={(e) => setPicked(e.target.value)}
                    >
                      <option value="">— wybierz lokalizację —</option>
                      {opts.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                    <div className="mt-2 text-xs opacity-70">Musisz wybrać lokację, żeby wejść w tryb transferu.</div>
                  </div>

                  <div className="mt-4 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      className="rounded-md border border-border bg-card px-3 py-2 text-xs hover:bg-background/10"
                      onClick={() => setPickOpen(false)}
                    >
                      Anuluj
                    </button>
                    <button
                      type="button"
                      disabled={!picked}
                      className={cx(
                        "rounded-md border px-3 py-2 text-xs font-medium",
                        picked
                          ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/20"
                          : "border-border bg-background/10 text-muted-foreground opacity-60 cursor-not-allowed"
                      )}
                      onClick={confirmPick}
                    >
                      Włącz transfer
                    </button>
                  </div>
                </div>

                <div className="mt-3 text-xs opacity-70">
                  Po włączeniu: kliknij materiał → wpisz ilość → potwierdź. Operację możesz powtarzać do oporu.
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}