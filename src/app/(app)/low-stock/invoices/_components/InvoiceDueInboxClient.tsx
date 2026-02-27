// src/app/(app)/low-stock/invoices/_components/InvoiceDueInboxClient.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Invoice = {
  event_id: string;
  delivery_id: string;

  date: string | null;
  supplier: string | null;
  place_label: string | null;

  delivery_cost: number;
  materials_cost: number;
  total_cost: number;

  payment_due_date: string | null;
  is_overdue: boolean;
  days_to_due: number | null;

  inventory_location_label: string;
  acknowledged_at: string | null;
};

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

function fmtDatePL(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pl-PL");
}

export default function InvoiceDueInboxClient({
  initialInvoices,
  ackInvoiceDue,
  markDeliveryPaid,
}: {
  initialInvoices: Invoice[];
  ackInvoiceDue: (formData: FormData) => Promise<void>;
  markDeliveryPaid: (formData: FormData) => Promise<void>;
}) {
  const [rows, setRows] = useState<Invoice[]>(initialInvoices);

  useEffect(() => setRows(initialInvoices), [initialInvoices]);

  const fresh = useMemo(() => rows.filter((x) => !x.acknowledged_at), [rows]);
  const seen = useMemo(() => rows.filter((x) => !!x.acknowledged_at), [rows]);

  const fmtCurrency = useMemo(
    () =>
      new Intl.NumberFormat("pl-PL", {
        style: "currency",
        currency: "PLN",
        maximumFractionDigits: 2,
      }),
    []
  );

  const BTN_WHITE = cx(
    "border px-3 py-2 rounded-2xl text-sm font-semibold",
    "bg-white text-black border-white/20 hover:bg-white/90",
    "shadow-sm shadow-black/10"
  );

  const BTN_WHITE_SOFT = cx(
    "border px-3 py-2 rounded-2xl text-sm font-semibold",
    "bg-white/90 text-black border-white/20 hover:bg-white",
    "shadow-sm shadow-black/10"
  );

  function DuePill({ dueISO, days }: { dueISO: string | null; days: number | null }) {
    const txt =
      typeof days === "number"
        ? days < 0
          ? `po terminie o ${Math.abs(days)} dni`
          : days === 0
          ? "termin dzisiaj"
          : `za ${days} dni`
        : "—";

    const urgent = typeof days === "number" && days <= 3;
    const overdue = typeof days === "number" && days < 0;

    return (
      <div
        className={cx(
          "rounded-2xl border px-3 py-2",
          overdue
            ? "border-red-500/40 bg-red-600/15"
            : urgent
            ? "border-amber-500/40 bg-amber-600/15"
            : "border-border bg-background/10"
        )}
      >
        <div className="text-[11px] uppercase tracking-wide opacity-70">Termin płatności</div>
        <div className="mt-0.5 text-sm font-semibold">
          {fmtDatePL(dueISO)} <span className="opacity-70 font-medium">• {txt}</span>
        </div>
      </div>
    );
  }

  function Card({ inv, showAck }: { inv: Invoice; showAck: boolean }) {
    return (
      <li className="rounded-2xl border border-border bg-card overflow-hidden transition hover:bg-background/10 hover:border-border/80">
        <Link href={`/reports/deliveries/${inv.delivery_id}`} className="block">
          <div className="p-4 space-y-3">
            {/* ✅ MOBILE: kolumna, DESKTOP: wiersz */}
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[12px] underline underline-offset-2">
                    #{inv.delivery_id.slice(0, 8)}
                  </span>

                  <span className="px-2 py-0.5 rounded text-[10px] bg-amber-600/20 text-amber-300 border border-amber-500/40">
                    budżet do zapłaty
                  </span>

                  {inv.is_overdue ? (
                    <span className="px-2 py-0.5 rounded text-[10px] bg-red-600/20 text-red-300 border border-red-500/40">
                      po terminie
                    </span>
                  ) : null}
                </div>

                <div className="mt-2 flex flex-wrap gap-2 text-[11px] opacity-80">
                  <span className="rounded border border-emerald-500/35 bg-emerald-500/10 text-emerald-300 px-2 py-0.5">
                    Lokalizacja: <strong className="font-semibold">{inv.inventory_location_label}</strong>
                  </span>

                  <span className="opacity-80">
                    {inv.place_label || "brak miejsca"} • {fmtDatePL(inv.date)}
                  </span>

                  {inv.supplier ? <span className="opacity-70">• {inv.supplier}</span> : null}
                </div>
              </div>

              {/* ✅ MOBILE: full width */}
              <div className="w-full lg:w-[320px]">
                <DuePill dueISO={inv.payment_due_date} days={inv.days_to_due} />
              </div>
            </div>

            <div className="flex flex-wrap gap-3 text-[12px]">
              <span className="opacity-75">
                Materiały: <strong className="opacity-100">{fmtCurrency.format(inv.materials_cost ?? 0)}</strong>
              </span>
              <span className="opacity-75">
                Dostawa: <strong className="opacity-100">{fmtCurrency.format(inv.delivery_cost ?? 0)}</strong>
              </span>
              <span className="opacity-75">
                Razem: <strong className="opacity-100">{fmtCurrency.format(inv.total_cost ?? 0)}</strong>
              </span>
            </div>
          </div>
        </Link>

        {/* ✅ MOBILE: przyciski w kolumnie, zero własnego pending */}
        <div className="px-4 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
          {showAck ? (
            <form
              action={ackInvoiceDue}
              onSubmit={() => {
                window.dispatchEvent(new Event("alerts:refresh"));
              }}
              className="w-full sm:w-auto"
            >
              <input type="hidden" name="event_ids" value={JSON.stringify([inv.event_id])} />
              <button type="submit" className={cx(BTN_WHITE, "w-full sm:w-auto")}>
                Sprawdzone
              </button>
            </form>
          ) : (
            <span className="text-xs opacity-60 px-2 py-1 rounded border border-border bg-background/10 w-fit">
              sprawdzone
            </span>
          )}

          <form
            action={markDeliveryPaid}
            onSubmit={() => {
              window.dispatchEvent(new Event("alerts:refresh"));
            }}
            className="w-full sm:w-auto"
          >
            <input type="hidden" name="delivery_id" value={inv.delivery_id} />
            <button
              type="submit"
              className={cx(
                "border px-3 py-2 rounded-2xl text-sm font-semibold w-full sm:w-auto",
                "border-emerald-500/60 bg-emerald-600/20 text-emerald-100 hover:bg-emerald-600/30"
              )}
            >
              Oznacz jako opłaconą
            </button>
          </form>
        </div>
      </li>
    );
  }

  return (
    <div className="space-y-8">
      {fresh.length > 0 ? (
        <section className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <div className="text-lg font-semibold">Nowe</div>
              <div className="text-xs opacity-70 mt-1">Pozycje, których jeszcze nie oznaczyłeś jako sprawdzone.</div>
            </div>

            {/* ✅ MOBILE: full width */}
            <form
              action={ackInvoiceDue}
              onSubmit={() => {
                window.dispatchEvent(new Event("alerts:refresh"));
              }}
              className="w-full sm:w-auto"
            >
              <input type="hidden" name="event_ids" value={JSON.stringify(fresh.map((x) => x.event_id))} />
              <button type="submit" className={cx(BTN_WHITE_SOFT, "w-full sm:w-auto")}>
                Oznacz wszystkie jako sprawdzone
              </button>
            </form>
          </div>

          <ul className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            {fresh.map((inv) => (
              <Card key={inv.event_id} inv={inv} showAck />
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">Sprawdzone</div>
        </div>

        {seen.length === 0 && fresh.length === 0 ? (
          <p className="text-sm opacity-70">Brak faktur do opłacenia z ustawionym terminem płatności.</p>
        ) : seen.length === 0 ? (
          <p className="text-sm opacity-70">Brak pozycji oznaczonych jako sprawdzone.</p>
        ) : (
          <ul className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            {seen.map((inv) => (
              <Card key={inv.event_id} inv={inv} showAck={false} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}