"use client";

import RoleGuard from "@/components/RoleGuard";
import { PERM } from "@/lib/permissions";

type DeliveryItemDraft = {
  material_id: string;
  title: string;
  qty: number;
  unit_price: number;
};

export type DeliveryDraft = {
  date: string | null;
  place_label: string | null;
  person: string | null;
  supplier?: string | null;
  delivery_cost: number | null;
  materials_cost: number | null; // jeżeli null, można liczyć z pozycji
  items: DeliveryItemDraft[];
};

type Props = {
  draft: DeliveryDraft;
  /** Callback po kliknięciu w przycisk potwierdzenia (np. zapis do bazy). */
  onConfirm?: () => void;
  /** Tekst na przycisku potwierdzenia. Domyślnie: "Dodaj dostawę jako oczekującą". */
  confirmLabel?: string;
  /** Czy przycisk ma być nieaktywny (np. w trakcie zapisu). */
  confirmDisabled?: boolean;
};

function DeliverySummaryDraftInner({
  draft,
  onConfirm,
  confirmLabel = "Dodaj dostawę jako oczekującą",
  confirmDisabled = false,
}: Props) {
  const itemsCount = draft.items?.length ?? 0;

  const itemsTotal = (draft.items ?? []).reduce(
    (sum, it) => sum + (it.qty || 0) * (it.unit_price || 0),
    0
  );

  const materialsCost =
    draft.materials_cost !== null && draft.materials_cost !== undefined
      ? draft.materials_cost
      : itemsTotal;

  const deliveryCost = draft.delivery_cost ?? 0;
  const grandTotal = materialsCost + deliveryCost;

  const dateLabel = draft.date || "nie podano";
  const placeLabel = draft.place_label || "nie podano";
  const personLabel = draft.person || "nie podano";
  const supplierLabel = draft.supplier || "—";

  return (
    <section className="space-y-3">
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <header className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-medium">Podsumowanie (draft)</h2>
            <p className="text-xs opacity-70">
              Sprawdź dane dostawy przed zapisaniem. Po potwierdzeniu dostawa
              trafi na listę oczekujących na akceptację.
            </p>
          </div>
          <span className="text-[11px] opacity-70">
            Pozycji: <strong>{itemsCount}</strong>
          </span>
        </header>

        {/* Dane ogólne */}
        <div className="grid gap-2 text-xs md:grid-cols-2 lg:grid-cols-3">
          <div>
            <div className="opacity-60">Miejsce:</div>
            <div className="font-medium">{placeLabel}</div>
          </div>
          <div>
            <div className="opacity-60">Data:</div>
            <div className="font-medium">{dateLabel}</div>
          </div>
          <div>
            <div className="opacity-60">Zgłaszający:</div>
            <div className="font-medium">{personLabel}</div>
          </div>
          <div>
            <div className="opacity-60">Dostawca:</div>
            <div className="font-medium">{supplierLabel}</div>
          </div>
        </div>

        {/* Koszty */}
        <div className="grid gap-2 text-xs md:grid-cols-2 lg:grid-cols-3 pt-2 border-t border-border/70">
          <div>
            <div className="opacity-60">Koszt dostawy (transport):</div>
            <div className="font-medium">
              {deliveryCost.toLocaleString("pl-PL", {
                style: "currency",
                currency: "PLN",
                maximumFractionDigits: 2,
              })}
            </div>
          </div>
          <div>
            <div className="opacity-60">Koszt materiałów:</div>
            <div className="font-medium">
              {materialsCost.toLocaleString("pl-PL", {
                style: "currency",
                currency: "PLN",
                maximumFractionDigits: 2,
              })}
            </div>
            {materialsCost !== itemsTotal && (
              <div className="text-[10px] opacity-60">
                Z pozycji:{" "}
                {itemsTotal.toLocaleString("pl-PL", {
                  style: "currency",
                  currency: "PLN",
                  maximumFractionDigits: 2,
                })}
              </div>
            )}
          </div>
          <div>
            <div className="opacity-60">Razem (materiały + dostawa):</div>
            <div className="font-semibold">
              {grandTotal.toLocaleString("pl-PL", {
                style: "currency",
                currency: "PLN",
                maximumFractionDigits: 2,
              })}
            </div>
          </div>
        </div>

        {/* Krótka lista pozycji */}
        {itemsCount > 0 && (
          <div className="pt-3 border-t border-border/70 space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="opacity-70">Pozycje (podgląd)</span>
              {itemsCount > 5 && (
                <span className="text-[10px] opacity-60">
                  Pokazuję pierwsze 5 z {itemsCount} pozycji
                </span>
              )}
            </div>
            <div className="space-y-1 max-h-40 overflow-auto pr-1">
              {(draft.items ?? []).slice(0, 5).map((it, idx) => {
                const lineTotal = (it.qty || 0) * (it.unit_price || 0);
                return (
                  <div
                    key={`${it.material_id}-${idx}`}
                    className="flex items-center justify-between gap-2 rounded border border-border/60 bg-background/40 px-2 py-1"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{it.title}</div>
                      <div className="text-[10px] opacity-70">
                        Ilość: {it.qty} ×{" "}
                        {it.unit_price.toLocaleString("pl-PL", {
                          maximumFractionDigits: 2,
                        })}
                      </div>
                    </div>
                    <div className="text-[11px] font-medium whitespace-nowrap">
                      {lineTotal.toLocaleString("pl-PL", {
                        style: "currency",
                        currency: "PLN",
                        maximumFractionDigits: 2,
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Przycisk potwierdzenia */}
        {onConfirm && (
          <div className="pt-3 border-t border-border/70 flex justify-end">
            <button
              type="button"
              onClick={onConfirm}
              disabled={confirmDisabled}
              className="px-4 py-2 rounded border border-border bg-emerald-500 text-xs font-medium text-black hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {confirmDisabled ? "Zapisywanie…" : confirmLabel}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

export default function DeliverySummaryDraft(props: Props) {
  return (
    <RoleGuard allow={PERM.DELIVERIES_CREATE} silent>
      <DeliverySummaryDraftInner {...props} />
    </RoleGuard>
  );
}
