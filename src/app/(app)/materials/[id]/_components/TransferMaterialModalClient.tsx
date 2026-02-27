// src/app/(app)/materials/[id]/_components/TransferMaterialModalClient.tsx
"use client";

import { useMemo, useState } from "react";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

type Loc = { id: string; label: string };

type OtherRow = {
  id: string;
  inventory_location_id: string | null;
  inventory_location_label: string | null;
  current_quantity: number | string | null;
};

type Props = {
  canWrite: boolean;
  materialId: string;

  fromLocationId: string | null;
  fromLocationLabel: string | null;

  unit: string | null;
  fromQty: number;

  locations: Loc[];
  sameTitleRows: OtherRow[];

  action: (formData: FormData) => void;
};

function toNum(v: unknown) {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") return Number(v) || 0;
  return 0;
}

function onlyDigits(s: string) {
  // tylko cyfry (bez przecinka / kropki)
  return (s ?? "").replace(/[^\d]/g, "");
}

export default function TransferMaterialModalClient({
  canWrite,
  materialId,
  fromLocationId,
  fromLocationLabel,
  unit,
  fromQty,
  locations,
  sameTitleRows,
  action,
}: Props) {
  const [open, setOpen] = useState(false);

  const availableTargets = useMemo(() => {
    return (locations ?? []).filter((l) => String(l.id) !== String(fromLocationId ?? ""));
  }, [locations, fromLocationId]);

  const [toLocationId, setToLocationId] = useState<string>(() => availableTargets[0]?.id ?? "");
  const [qtyInput, setQtyInput] = useState<string>("");

  const toLocLabel = useMemo(() => {
    const hit = (locations ?? []).find((x) => String(x.id) === String(toLocationId));
    return hit?.label ?? "—";
  }, [locations, toLocationId]);

  const toQtyBefore = useMemo(() => {
    const hit = (sameTitleRows ?? []).find(
      (r) => String(r.inventory_location_id ?? "") === String(toLocationId)
    );
    return toNum(hit?.current_quantity ?? 0);
  }, [sameTitleRows, toLocationId]);

  const qty = useMemo(() => {
    const v = Number(qtyInput);
    if (!Number.isFinite(v)) return 0;
    return Math.max(0, Math.trunc(v));
  }, [qtyInput]);

  const fromAfter = Math.max(0, fromQty - qty);
  const toAfter = Math.max(0, toQtyBefore + qty);

  const canSubmit =
    canWrite &&
    !!toLocationId &&
    qty > 0 &&
    qty <= fromQty &&
    String(toLocationId) !== String(fromLocationId ?? "");

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!canWrite}
        className={cx(
          "w-full sm:w-auto",
          "border border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
          "px-3 py-2 text-sm font-medium rounded-md hover:bg-emerald-500/15 transition",
          !canWrite && "opacity-60 pointer-events-none"
        )}
      >
        Transfer
      </button>

      {open ? (
        <div className="fixed inset-0 z-[9998]">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />

          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold">Przenieś materiał</div>
                    <div className="mt-1 text-sm opacity-75">
                      Przeniesiesz część stanu z <b>{fromLocationLabel ?? "—"}</b> do wskazanej lokalizacji.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="px-3 py-2 text-xs rounded-md border border-border bg-background/30 hover:bg-background/40 transition"
                  >
                    Zamknij
                  </button>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-sm opacity-80">Lokalizacja docelowa</label>
                    <select
                      value={toLocationId}
                      onChange={(e) => setToLocationId(e.target.value)}
                      className="w-full border border-border rounded-md px-3 py-2 bg-background hover:bg-foreground/5 transition"
                    >
                      {availableTargets.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                    <div className="text-[11px] opacity-70">
                      Z: <b>{fromLocationLabel ?? "—"}</b> → Do: <b>{toLocLabel}</b>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <label className="text-sm opacity-80">Ilość do przeniesienia</label>
                    <input
                      value={qtyInput}
                      onChange={(e) => setQtyInput(onlyDigits(e.target.value))}
                      inputMode="numeric"
                      placeholder="np. 1"
                      className="w-full border border-border rounded-md px-3 py-2 bg-background hover:bg-foreground/5 transition"
                    />
                    <div className="text-[11px] opacity-70">
                      Dostępne w źródle: <b>{fromQty}</b> {unit ?? ""}
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-border bg-background/20 p-4">
                  <div className="text-sm font-medium">Podgląd</div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <div className="rounded-xl border border-border bg-background/30 px-3 py-3">
                      <div className="text-[11px] opacity-70">W źródle</div>
                      <div className="mt-1 text-sm font-semibold">
                        {fromQty} {unit ?? ""}
                      </div>
                    </div>

                    <div className="rounded-xl border border-border bg-background/30 px-3 py-3">
                      <div className="text-[11px] opacity-70">Przenosisz</div>
                      <div className="mt-1 text-sm font-semibold">
                        {qty || 0} {unit ?? ""}
                      </div>
                    </div>

                    <div className="rounded-xl border border-border bg-background/30 px-3 py-3">
                      <div className="text-[11px] opacity-70">W docelowej</div>
                      <div className="mt-1 text-sm font-semibold">
                        {toAfter} {unit ?? ""}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 text-[12px] opacity-75">
                    Po transferze: źródło będzie miało <b>{fromAfter}</b>, a docelowa <b>{toAfter}</b>.
                  </div>
                </div>

                <form
                  action={action}
                  className="mt-4 flex items-center justify-end gap-2"
                  onSubmit={() => {
                    // ✅ znika od razu po potwierdzeniu
                    setOpen(false);
                  }}
                >
                  <input type="hidden" name="from_material_id" value={materialId} />
                  <input type="hidden" name="to_location_id" value={toLocationId} />
                  <input type="hidden" name="qty" value={String(qty || 0)} />

                  <button
                    type="button"
                    className="px-4 py-2 rounded-md border border-border bg-background/30 hover:bg-background/40 transition"
                    onClick={() => setOpen(false)}
                  >
                    Anuluj
                  </button>

                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className={cx(
                      "px-4 py-2 rounded-md border",
                      "border-emerald-500/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/20 transition",
                      !canSubmit && "opacity-60 pointer-events-none"
                    )}
                  >
                    Potwierdź transfer
                  </button>
                </form>

                {!canSubmit ? (
                  <div className="mt-2 text-[11px] opacity-60">
                    Warunki: wybierz lokalizację (inną niż źródło) i wpisz ilość &gt; 0 oraz ≤ dostępny stan.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}