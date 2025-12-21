// src/app/(app)/low-stock/invoices/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";
import { markDeliveryPaid } from "@/lib/actions";
import LowStockTabs from "@/components/low-stock/LowStockTabs";

type InvoiceRowRaw = {
  id: string;
  date: string | null;
  supplier: string | null;
  place_label: string | null;
  delivery_cost: number | string | null;
  materials_cost: number | string | null;
  total_cost: number | string | null;
  payment_due_date: string | null;
  is_paid: boolean | null;
  is_overdue: boolean | null;
  days_to_due: number | string | null;
};

function toNum(v: number | string | null) {
  if (v == null) return 0;
  if (typeof v === "string") return Number.parseFloat(v) || 0;
  return v;
}

function toInt(v: number | string | null) {
  if (v == null) return null;
  if (typeof v === "string") {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  }
  return Number.isFinite(v) ? v : null;
}

function fmtDatePL(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pl-PL");
}

export default async function InvoicesPage() {
  const supabase = await supabaseServer();

  // --- gate: tylko owner/manager/storeman ---
  const { data: snap, error: snapErr } = await supabase.rpc("my_permissions_snapshot");
  if (snapErr) {
    // jak snapshot nie działa, lepiej schować stronę niż pokazać coś nie temu komu trzeba
    notFound();
  }

  const snapshot = Array.isArray(snap) ? (snap[0] ?? null) : (snap as any);
  const role = String(snapshot?.role ?? "");

  const canSee = role === "owner" || role === "manager" || role === "storeman";
  if (!canSee) notFound();

  // --- data ---
  const { data: invData, error: invError } = await (supabase as any)
  .from("v_deliveries_overview")
  .select(
    [
      "id",
      "date",
      "supplier",
      "place_label",
      "delivery_cost",
      "materials_cost",
      "total_cost",
      "payment_due_date",
      "is_paid",
      "is_overdue",
      "days_to_due",
      "deleted_at",
    ].join(", ")
  )
  .eq("is_paid", false)
  .not("payment_due_date", "is", null)
  .is("deleted_at", null)
  .order("payment_due_date", { ascending: true })
  .limit(50);

const rawInvoices = (invData ?? []) as InvoiceRowRaw[];


  const invoices = rawInvoices.map((r) => ({
    id: r.id,
    date: r.date,
    supplier: r.supplier,
    place_label: r.place_label,
    delivery_cost: toNum(r.delivery_cost),
    materials_cost: toNum(r.materials_cost),
    total_cost: toNum(r.total_cost),
    payment_due_date: r.payment_due_date,
    is_paid: r.is_paid,
    is_overdue: r.is_overdue,
    days_to_due: toInt(r.days_to_due),
  }));

  const fmtCurrency = new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 2,
  });

  return (
    <div className="p-6 space-y-8">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Co się kończy – faktury</h1>
          <p className="text-xs opacity-70 mt-1">
            Nieopłacone faktury z ustawionym terminem płatności.
          </p>
        </div>
        <LowStockTabs />
      </header>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide opacity-80">
            Faktury do opłacenia
          </h2>
          <span className="text-xs opacity-70">
            Pokazuję maksymalnie 50 najbliższych terminów płatności.
          </span>
        </div>

        {invError && (
          <p className="text-sm text-red-400">
            Błąd ładowania faktur: {invError.message}
          </p>
        )}

        {!invError && invoices.length === 0 && (
          <p className="text-sm opacity-70">
            Brak nieopłaconych faktur z ustawionym terminem płatności.
          </p>
        )}

        {!invError && invoices.length > 0 && (
          <ul className="space-y-2">
            {invoices.map((inv) => (
              <li
                key={inv.id}
                className="rounded-2xl border border-border bg-card px-4 py-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
              >
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/reports/deliveries/${inv.id}`}
                      className="font-mono text-[11px] underline underline-offset-2"
                    >
                      #{inv.id.slice(0, 8)}
                    </Link>

                    {inv.is_overdue ? (
                      <span className="px-2 py-0.5 rounded text-[10px] bg-red-600/20 text-red-300 border border-red-500/40">
                        po terminie
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] bg-amber-600/20 text-amber-300 border border-amber-500/40">
                        do zapłaty
                      </span>
                    )}
                  </div>

                  <div className="opacity-80">
                    {inv.place_label || "brak miejsca"} • {fmtDatePL(inv.date)}
                  </div>

                  <div className="opacity-70">
                    {inv.supplier || "nie podano dostawcy"}
                  </div>

                  <div className="flex flex-wrap gap-2 text-[11px] pt-1">
                    <span className="opacity-75">
                      Materiały:{" "}
                      <strong className="opacity-100">
                        {fmtCurrency.format(inv.materials_cost ?? 0)}
                      </strong>
                    </span>
                    <span className="opacity-75">
                      Dostawa:{" "}
                      <strong className="opacity-100">
                        {fmtCurrency.format(inv.delivery_cost ?? 0)}
                      </strong>
                    </span>
                    <span className="opacity-75">
                      Razem:{" "}
                      <strong className="opacity-100">
                        {fmtCurrency.format(inv.total_cost ?? 0)}
                      </strong>
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 text-[11px] pt-1">
                    <span className="opacity-80">
                      Termin płatności:{" "}
                      <strong>{fmtDatePL(inv.payment_due_date)}</strong>
                    </span>

                    {typeof inv.days_to_due === "number" && (
                      <span className="opacity-70">
                        {inv.days_to_due < 0
                          ? `po terminie o ${Math.abs(inv.days_to_due)} dni`
                          : inv.days_to_due === 0
                          ? "termin dzisiaj"
                          : `za ${inv.days_to_due} dni`}
                      </span>
                    )}
                  </div>
                </div>

                {/* akcja widoczna tylko dla owner/manager/storeman */}
                <div className="flex items-center gap-2 justify-end">
                  <form action={markDeliveryPaid}>
                    <input type="hidden" name="delivery_id" value={inv.id} />
                    <button
                      type="submit"
                      className="px-3 py-1 rounded border border-emerald-500/60 bg-emerald-600/20 text-emerald-100 hover:bg-emerald-600/30 text-xs"
                    >
                      Oznacz jako opłaconą
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
