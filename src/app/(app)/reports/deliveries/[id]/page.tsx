// src/app/(app)/reports/deliveries/[id]/page.tsx
import Link from "next/link";

import { supabaseServer } from "@/lib/supabaseServer";
import { getInvoiceSignedUrl } from "@/lib/uploads/invoices";
import { getPermissionSnapshot } from "@/lib/currentUser";
import { can, PERM } from "@/lib/permissions";

import DeliveryInvoicesOverlay from "@/components/DeliveryInvoicesOverlay";

type DeliveryRow = {
  id: string;
  date: string | null;
  created_at: string | null;
  person: string | null;
  place_label: string | null;
  supplier: string | null;
  delivery_cost: number | null;
  materials_cost: number | null;
  invoice_url: string | null; // PATH w buckecie invoices (legacy / single)
  items: any[] | null; // JSONB z pozycjami dostawy
  approved: boolean | null;

  deleted_at?: string | null;

  // ✅ magazynowa lokalizacja (jak daily)
  inventory_location_id?: string | null;
  inventory_locations?: { label?: string | null } | null;

  // PŁATNOŚĆ – dane z tabeli
  is_paid: boolean | null;
  payment_due_date: string | null;
  paid_at: string | null;
  paid_by: string | null;

  // PŁATNOŚĆ – pola wyliczane lokalnie
  payment_status: string | null;
  days_to_due: number | null;
  is_overdue: boolean | null;
};

type UiItem = {
  key: string;
  materialId: string | null;
  materialTitle: string;
  unit: string | null;
  quantity: number;
  unitPrice: number;
  value: number;
};

/* ------------------------------------------------------------------ */
/* UI helpers (KANON: jak daily)                                       */
/* ------------------------------------------------------------------ */

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "ok" | "warn" | "bad";
  className?: string;
}) {
  const cls =
    tone === "ok"
      ? "border-emerald-500/40 bg-emerald-600/10 text-emerald-200"
      : tone === "warn"
      ? "border-amber-500/40 bg-amber-600/10 text-amber-200"
      : tone === "bad"
      ? "border-red-500/40 bg-red-600/10 text-red-200"
      : "border-border bg-background/40 text-foreground/80";

  return (
    <span
      className={cx(
        "text-[11px] px-2 py-1 rounded-full border whitespace-nowrap leading-none",
        cls,
        className
      )}
    >
      {children}
    </span>
  );
}

function Field({
  label,
  value,
  strong,
}: {
  label: string;
  value: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground/90">
        {label}
      </div>
      <div className={cx("text-[15px] leading-snug", strong && "font-semibold")}>
        {value}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const paymentLabel = (d: DeliveryRow): { text: string; tone: "ok" | "warn" | "bad" } => {
  if (d.is_paid) return { text: "opłacona", tone: "ok" };
  if (d.is_overdue) return { text: "po terminie", tone: "bad" };
  if (!d.payment_due_date) return { text: "nieopłacona (bez terminu)", tone: "warn" };
  return { text: "do zapłaty", tone: "warn" };
};

const computePaymentMeta = (row: {
  deleted_at?: string | null;
  is_paid: boolean | null;
  payment_due_date: string | null;
}): {
  payment_status: string | null;
  days_to_due: number | null;
  is_overdue: boolean | null;
} => {
  const today = new Date();
  let days_to_due: number | null = null;
  let is_overdue = false;

  if (row.payment_due_date) {
    const due = new Date(row.payment_due_date);
    const diffMs = due.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0);
    days_to_due = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (row.is_paid === false && days_to_due < 0) is_overdue = true;
  }

  let payment_status: string | null;
  if (row.deleted_at) payment_status = "deleted";
  else if (row.is_paid === true) payment_status = "paid";
  else if (!row.payment_due_date) payment_status = "unpaid_no_due";
  else if (days_to_due !== null && days_to_due < 0) payment_status = "overdue";
  else payment_status = "unpaid";

  return { payment_status, days_to_due, is_overdue };
};

function fmtDateOnly(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pl-PL");
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pl-PL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusMeta(approved: boolean | null) {
  return approved
    ? { text: "zatwierdzona", tone: "ok" as const }
    : { text: "oczekująca", tone: "warn" as const };
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const snap = await getPermissionSnapshot();
  if (!can(snap, PERM.REPORTS_DELIVERIES_READ)) {
    return (
      <main className="p-6">
        <div className="rounded-2xl border border-border bg-card p-4 text-sm text-foreground/80">
          Brak dostępu.
        </div>
      </main>
    );
  }

  const canInvoices = can(snap, PERM.REPORTS_DELIVERIES_INVOICES_READ);
  const supabase = await supabaseServer();

  const { data: rawDelivery, error: dErr } = await supabase
    .from("deliveries")
    .select(
      `
      id,
      date,
      created_at,
      person,
      place_label,
      supplier,
      delivery_cost,
      materials_cost,
      invoice_url,
      items,
      approved,
      deleted_at,

      is_paid,
      payment_due_date,
      paid_at,
      paid_by,

      inventory_location_id,
      inventory_locations:inventory_location_id ( label )
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (dErr || !rawDelivery) {
    return (
      <main className="p-6 space-y-3">
        <h1 className="text-lg font-semibold">Dostawa nie została znaleziona</h1>
        <p className="text-xs opacity-70">
          Sprawdź, czy adres jest poprawny lub wróć do listy dostaw.
        </p>
      </main>
    );
  }

  const meta = computePaymentMeta({
    deleted_at: (rawDelivery as any).deleted_at,
    is_paid: (rawDelivery as any).is_paid,
    payment_due_date: (rawDelivery as any).payment_due_date,
  });

  const d: DeliveryRow = {
    ...(rawDelivery as any),
    payment_status: meta.payment_status,
    days_to_due: meta.days_to_due,
    is_overdue: meta.is_overdue,
  };

  // paid_by => imię nazwisko (fallback)
  let paidByName: string | null = null;
  if (d.paid_by) {
    const { data: who } = await supabase
      .from("team_members")
      .select("first_name,last_name")
      .eq("user_id", d.paid_by)
      .maybeSingle();

    const fn = (who as any)?.first_name ?? "";
    const ln = (who as any)?.last_name ?? "";
    const full = `${String(fn).trim()} ${String(ln).trim()}`.trim();
    paidByName = full || null;
  }

  // Items z JSONB
  const rawItems: any[] = Array.isArray(d.items) ? d.items : [];

  const materialIds = Array.from(
    new Set(rawItems.map((it) => it.material_id as string | undefined).filter(Boolean) as string[])
  );

  let materialsById: Record<string, { title: string; unit: string | null }> = {};
  if (materialIds.length > 0) {
    const { data: mats, error: mErr } = await supabase
      .from("materials")
      .select("id,title,unit")
      .in("id", materialIds);

    if (!mErr && mats) {
      materialsById = Object.fromEntries(
        mats.map((m: any) => [m.id, { title: m.title, unit: m.unit }])
      );
    }
  }

  const uiItems: UiItem[] = rawItems.map((it, idx) => {
    const qtyRaw = it.qty ?? it.quantity ?? 0;
    const qty = Number(qtyRaw) || 0;

    const priceRaw = it.unit_price ?? it.price ?? 0;
    const unitPrice = Number(priceRaw) || 0;

    const value = qty * unitPrice;

    const materialId: string | null = it.material_id ?? null;
    const metaMat = materialId ? materialsById[materialId] : undefined;

    const materialTitle = metaMat?.title ?? materialId ?? "Nieznany materiał (brak w katalogu)";
    const unit = metaMat?.unit ?? null;

    return {
      key: `${idx}`,
      materialId,
      materialTitle,
      unit,
      quantity: qty,
      unitPrice,
      value,
    };
  });

  const itemsTotal = uiItems.reduce((s, it) => s + it.value, 0);
  const materialsCost = (d.materials_cost ?? itemsTotal) || 0;
  const deliveryCost = d.delivery_cost ?? 0;
  const grand = materialsCost + deliveryCost;

  const baseDate = d.date ?? d.created_at ?? null;
  const dateLabel = fmtDateOnly(baseDate);

  const money = new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 2,
  });

  // Legacy: pojedynczy plik (fallback)
  let invoiceHref: string | null = null;
  if (canInvoices && d.invoice_url) {
    try {
      invoiceHref = await getInvoiceSignedUrl({ path: d.invoice_url });
    } catch (e) {
      console.warn(
        "reports/deliveries/[id] getInvoiceSignedUrl error:",
        (e as Error)?.message ?? e
      );
      invoiceHref = null;
    }
  }

  const pay = paymentLabel(d);
  const dueDateLabel = d.payment_due_date ? fmtDateOnly(d.payment_due_date) : "brak";
  const days = typeof d.days_to_due === "number" ? d.days_to_due : null;

  const st = statusMeta(d.approved);

  const placeLabel = d.place_label || "—";
  const supplierLabel = d.supplier || "—";
  const personLabel = d.person || "—";

  const inventoryLocationLabel = (d.inventory_locations?.label ?? null) || "—";

  const paymentHint =
    d.is_paid
      ? null
      : days === null
      ? null
      : days < 0
      ? `po terminie o ${Math.abs(days)} dni`
      : days === 0
      ? "termin dzisiaj"
      : `za ${days} dni`;

  return (
    <main className="space-y-4">
      {/* HEADER (KANON: jak daily) */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-base font-semibold">Dostawa</h1>
          <p className="text-xs opacity-70">
            Szczegóły dostawy — pozycje, koszty, dokumenty oraz status magazynu i płatności.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge className="px-3" tone={st.tone}>
            {st.text}
          </Badge>
          <Badge className="px-3">ID #{String(d.id).slice(0, 8)}</Badge>
        </div>
      </header>

      {/* MAIN GRID: LEFT (meta+payment+cost+docs) / RIGHT (items) */}
      <section className="grid gap-4 lg:grid-cols-2 items-start">
        {/* LEFT */}
        <div className="space-y-4">
          {/* META PANEL */}
          <section className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-sm font-medium">Podstawowe informacje</div>
                <div className="flex items-center gap-2">
                  <Badge tone={st.tone}>{st.text}</Badge>
                  <Badge tone={pay.tone}>{pay.text}</Badge>
                  {paymentHint ? <span className="text-xs opacity-70">({paymentHint})</span> : null}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Data" value={dateLabel} strong />
                <Field label="Zgłaszający" value={personLabel} strong />

                <Field label="Miejsce" value={placeLabel} />
                <Field label="Lokalizacja magazynowa" value={inventoryLocationLabel} />

                <Field label="Dostawca" value={supplierLabel} />
                <Field label="Pozycji" value={uiItems.length} />
              </div>
            </div>
          </section>

          {/* PŁATNOŚĆ */}
          <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium">Płatność</h2>
              <Badge tone={pay.tone}>{pay.text}</Badge>
            </div>

            {!d.is_paid ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Termin" value={dueDateLabel} strong />
                <Field
                  label="Status"
                  value={
                    days === null
                      ? "—"
                      : days < 0
                      ? `po terminie o ${Math.abs(days)} dni`
                      : days === 0
                      ? "termin dzisiaj"
                      : `do terminu zostało ${days} dni`
                  }
                  strong
                />
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Opłacona" value={fmtDateTime(d.paid_at)} strong />
                <Field label="Kto oznaczył" value={paidByName ?? "—"} />
              </div>
            )}
          </section>

          {/* KOSZTY */}
          <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <h2 className="text-sm font-medium">Koszty</h2>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Materiały" value={money.format(materialsCost)} strong />
              <Field label="Dostawa" value={money.format(deliveryCost)} strong />
              <Field
                label="Razem"
                value={<span className="font-semibold">{money.format(grand)}</span>}
                strong
              />
              <Field label="Suma pozycji" value={money.format(itemsTotal)} />
            </div>
          </section>

          {/* DOKUMENTY */}
          <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <h2 className="text-sm font-medium">Dokumenty</h2>

            {!canInvoices ? (
              <div className="text-sm opacity-70">Brak dostępu do dokumentów.</div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <DeliveryInvoicesOverlay
                  deliveryId={d.id}
                  triggerLabel="Otwórz dokumenty"
                  triggerClassName="px-3 py-2 rounded border border-border bg-card hover:bg-card/80 text-sm transition"
                />

                {d.invoice_url && invoiceHref ? (
                  <a
                    href={invoiceHref}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-2 rounded border border-border bg-background/40 hover:bg-background/60 text-sm transition"
                  >
                    Legacy: otwórz w nowej karcie
                  </a>
                ) : null}

                {!d.invoice_url ? (
                  <span className="text-xs opacity-70">Brak plików przypiętych do dostawy.</span>
                ) : null}
              </div>
            )}
          </section>
        </div>

        {/* RIGHT: ITEMS */}
        <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-sm font-medium">Pozycje</h2>
              <div className="text-xs opacity-70">Pozycje: {uiItems.length}</div>
            </div>
            <Badge>{money.format(itemsTotal)}</Badge>
          </div>

          <div className="hidden sm:grid grid-cols-12 gap-2 text-[11px] uppercase tracking-wide opacity-70 px-3">
            <div className="col-span-6">Materiał</div>
            <div className="col-span-2 text-right">Ilość</div>
            <div className="col-span-2 text-right">Cena / j.</div>
            <div className="col-span-2 text-right">Wartość</div>
          </div>

          <div className="space-y-2">
            {uiItems.map((it) => {
              const href = it.materialId ? `/materials/${it.materialId}` : null;

              const row = (
                <div className="grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-12 sm:col-span-6 min-w-0">
                    <div className="font-medium truncate">{it.materialTitle}</div>
                  </div>

                  <div className="col-span-6 sm:col-span-2 text-right whitespace-nowrap">
                    <span className="sm:hidden opacity-60 mr-1">ILOŚĆ:</span>
                    {it.quantity.toLocaleString("pl-PL")}{" "}
                    {it.unit ? <span className="opacity-60">{it.unit}</span> : null}
                  </div>

                  <div className="col-span-6 sm:col-span-2 text-right whitespace-nowrap">
                    <span className="sm:hidden opacity-60 mr-1">CENA:</span>
                    {it.unitPrice ? money.format(it.unitPrice) : "—"}
                  </div>

                  <div className="col-span-12 sm:col-span-2 text-right whitespace-nowrap">
                    <span className="sm:hidden opacity-60 mr-1">WARTOŚĆ:</span>
                    <span className="font-semibold">{money.format(it.value)}</span>
                  </div>
                </div>
              );

              return href ? (
                <Link
                  key={it.key}
                  href={href}
                  className="block rounded-2xl border border-border bg-background/30 px-3 py-3 transition will-change-transform hover:bg-card/80 hover:border-border/80 active:scale-[0.995]"
                >
                  {row}
                </Link>
              ) : (
                <div
                  key={it.key}
                  className="rounded-2xl border border-border bg-background/30 px-3 py-3 opacity-90"
                >
                  {row}
                </div>
              );
            })}

            {uiItems.length === 0 ? (
              <div className="rounded-2xl border border-border bg-background/30 p-4 text-center text-xs opacity-60">
                Brak pozycji w tej dostawie.
              </div>
            ) : null}
          </div>
        </section>
      </section>
    </main>
  );
}