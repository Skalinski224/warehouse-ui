// src/app/(app)/materials/_components/MaterialsActionsBarWithTransfer.tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useTransferMode } from "@/app/(app)/materials/_components/TransferModeContext";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export default function MaterialsActionsBarWithTransfer({
  canSoftDelete,
  canWrite,
  addHref,
  multi,
  toggleMultiHref,
}: {
  canSoftDelete: boolean;
  canWrite: boolean;
  addHref: string;
  multi: boolean;
  toggleMultiHref: string;
}) {
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
      <div className="flex flex-wrap items-center justify-end gap-2">
        {canWrite ? (
          <Link
            href={addHref}
            className="border border-border bg-foreground text-background px-3 py-2 text-sm font-medium rounded-md hover:bg-foreground/90 transition"
          >
            + Dodaj materiał
          </Link>
        ) : null}

        {/* ✅ Transfer dokładnie między Dodaj a Usuń */}
        {!multi ? (
          enabled ? (
            <button
              type="button"
              onClick={endMode}
              className="border border-emerald-500/60 text-emerald-200 px-3 py-2 text-sm font-medium rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 transition"
              title={target ? `Docelowo: ${target.to_location_label}` : "Zakończ transfer"}
            >
              Zakończ transfer
            </button>
          ) : (
            <button
              type="button"
              onClick={openPick}
              className="border border-emerald-500/60 text-emerald-200 px-3 py-2 text-sm font-medium rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 transition"
            >
              Transfer
            </button>
          )
        ) : null}

        {canSoftDelete ? (
          <Link
            href={toggleMultiHref}
            className="border border-red-500/60 text-red-300 px-3 py-2 text-sm font-medium rounded-md bg-red-500/10 hover:bg-red-500/20 transition"
          >
            {multi ? "Zakończ zaznaczanie" : "Usuń kilka"}
          </Link>
        ) : null}
      </div>

      {/* Modal wyboru lokacji docelowej (jak na Twoim screenie) */}
      {pickOpen ? (
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/60" onClick={() => setPickOpen(false)} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-xl rounded-2xl border border-border bg-card shadow-2xl">
              <div className="flex items-start justify-between gap-3 p-5">
                <div>
                  <div className="text-base font-semibold">Transfer</div>
                  <div className="mt-1 text-sm opacity-80">
                    Wybierz lokację docelową. Potem klikaj materiały — pokaże się okno przeniesienia.
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
                  <select
                    className="mt-2 w-full rounded-md border border-border bg-background/30 px-3 py-2 text-sm"
                    value={picked}
                    onChange={(e) => setPicked(e.target.value)}
                  >
                    <option value="">— wybierz lokalizację —</option>
                    {opts.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <div className="mt-2 text-xs opacity-70">Lokalizacja musi być aktywna (nieusunięta).</div>
                </div>

                <div className="mt-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-md border border-border bg-background/20 px-4 py-2 text-sm hover:bg-background/30"
                    onClick={() => setPickOpen(false)}
                  >
                    Anuluj
                  </button>
                  <button
                    type="button"
                    disabled={!picked}
                    className={cx(
                      "rounded-md px-4 py-2 text-sm font-medium transition",
                      picked
                        ? "border border-emerald-500/60 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/20"
                        : "border border-border bg-background/10 text-muted-foreground opacity-60 cursor-not-allowed"
                    )}
                    onClick={confirmPick}
                  >
                    Rozpocznij transfer
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}