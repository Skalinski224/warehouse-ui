// src/app/(app)/reports/deliveries/[id]/page.tsx
import Link from "next/link";

import { supabaseServer } from "@/lib/supabaseServer";
import { getInvoiceSignedUrl } from "@/lib/uploads/invoices";
import { getPermissionSnapshot } from "@/lib/currentUser";
import { can, PERM } from "@/lib/permissions";
import BackButton from "@/components/BackButton";

type DeliveryRow = {
  id: string;
  date: string | null;
  created_at: string | null;
  person: string | null;
  place_label: string | null;
  supplier: string | null;
  delivery_cost: number | null;
  materials_cost: number | null;
  invoice_url: string | null; // PATH w buckecie invoices
  items: any[] | null; // JSONB z pozycjami dostawy
  approved: boolean | null;

  deleted_at?: string | null;

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

function Tag({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "ok" | "warn" | "bad";
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
    <span className={`text-[10px] px-2 py-0.5 rounded border ${cls}`}>
      {children}
    </span>
  );
}

function Pill({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <span className="text-[11px] px-2 py-1 rounded bg-background/60 border border-border">
      <span className="opacity-70">{label}:</span>{" "}
      <span className="font-semibold opacity-100">{value}</span>
    </span>
  );
}

function KV({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "neutral" | "ok" | "warn" | "bad";
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Tag tone={tone}>{label}</Tag>
      <div className="text-sm">{value}</div>
    </div>
  );
}

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

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
      [
        "id",
        "date",
        "created_at",
        "person",
        "place_label",
        "supplier",
        "delivery_cost",
        "materials_cost",
        "invoice_url",
        "items",
        "approved",
        "deleted_at",
        "is_paid",
        "payment_due_date",
        "paid_at",
        "paid_by",
      ].join(", ")
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
        <div>
          <BackButton className="px-3 py-2 rounded border border-border bg-card hover:bg-card/80 text-xs transition" />
        </div>
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
    new Set(
      rawItems
        .map((it) => it.material_id as string | undefined)
        .filter(Boolean) as string[]
    )
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

    const materialTitle =
      metaMat?.title ?? materialId ?? "Nieznany materiał (brak w katalogu)";
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

  // Faktura
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

  const approvedText = d.approved ? "zatwierdzona" : "oczekująca";
  const approvedTone: "ok" | "warn" = d.approved ? "ok" : "warn";

  const placeLabel = d.place_label || "brak miejsca";
  const supplierLabel = d.supplier || "nie podano";
  const personLabel = d.person || "nie podano";

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
    <main className="p-6 space-y-4">
      {/* HEADER (kanon) */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-sm font-medium">Raport: dostawa</h1>
          <p className="text-xs opacity-70">
            Szczegóły dostawy — pozycje, koszty, faktura, status magazynu i płatności.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Pill label="ID" value={`#${d.id.slice(0, 8)}`} />
          <BackButton className="px-3 py-2 rounded border border-border bg-card hover:bg-card/80 text-xs transition" />
        </div>
      </header>

      {/* META BAR (na tacy: etykieta → wartość) */}
      <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Pill label="DATA" value={dateLabel} />
          <Pill label="MIEJSCE" value={placeLabel} />
          <Pill label="DOSTAWCA" value={supplierLabel} />
          <Pill label="ZGŁASZAJĄCY" value={personLabel} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2">
            <Tag>STATUS MAGAZYNU</Tag>
            <Tag tone={approvedTone}>{approvedText}</Tag>
          </span>

          <span className="inline-flex items-center gap-2">
            <Tag>STATUS PŁATNOŚCI</Tag>
            <Tag tone={pay.tone}>{pay.text}</Tag>
            {paymentHint ? (
              <span className="text-xs opacity-70">({paymentHint})</span>
            ) : null}
          </span>

          <Pill label="POZYCJI" value={uiItems.length} />
        </div>
      </section>

      {/* GRID: lewa (płatność + koszty + faktura) / prawa (pozycje) */}
      <section className="grid gap-4 lg:grid-cols-2">
        {/* LEWA */}
        <div className="space-y-4">
          {/* PŁATNOŚĆ */}
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium">Płatność</h2>
              <Tag tone={pay.tone}>{pay.text}</Tag>
            </div>

            {!d.is_paid ? (
              <div className="space-y-2">
                <KV label="TERMIN" value={dueDateLabel} tone={d.is_overdue ? "bad" : "neutral"} />
                {days !== null ? (
                  <KV
                    label="ODLICZANIE"
                    value={
                      days < 0
                        ? `po terminie o ${Math.abs(days)} dni`
                        : days === 0
                        ? "termin dzisiaj"
                        : `do terminu zostało ${days} dni`
                    }
                    tone={days < 0 ? "bad" : "warn"}
                  />
                ) : null}
              </div>
            ) : (
              <div className="space-y-2">
                <KV label="OPŁACONA" value={fmtDateTime(d.paid_at)} tone="ok" />
                <KV label="KTO OZNACZYŁ" value={paidByName ?? "brak danych"} />
              </div>
            )}
          </div>

          {/* KOSZTY */}
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <h2 className="text-sm font-medium">Koszty</h2>

            <div className="space-y-2">
              <KV label="MATERIAŁY" value={money.format(materialsCost)} />
              <KV label="DOSTAWA" value={money.format(deliveryCost)} />
              <KV
                label="RAZEM"
                value={<span className="font-semibold">{money.format(grand)}</span>}
              />
            </div>
          </div>

          {/* FAKTURA */}
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <h2 className="text-sm font-medium">Dokument</h2>

            {!d.invoice_url ? (
              <KV label="FAKTURA" value={<span className="opacity-70">brak pliku</span>} />
            ) : !canInvoices ? (
              <KV
                label="FAKTURA"
                value={<span className="opacity-70">brak dostępu do dokumentu</span>}
                tone="warn"
              />
            ) : invoiceHref ? (
              <KV
                label="FAKTURA"
                value={
                  <a
                    href={invoiceHref}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2 opacity-90 hover:opacity-100"
                  >
                    otwórz w nowej karcie
                  </a>
                }
                tone="ok"
              />
            ) : (
              <KV
                label="FAKTURA"
                value={
                  <span className="opacity-70">
                    nie udało się wygenerować linku (spróbuj później)
                  </span>
                }
                tone="warn"
              />
            )}
          </div>
        </div>

        {/* PRAWA: POZYCJE */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium">Pozycje</h2>
            <Pill label="SUMA POZYCJI" value={money.format(itemsTotal)} />
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
                    {it.materialId ? (
                      <div className="font-mono text-[10px] opacity-60 truncate">
                        {it.materialId}
                      </div>
                    ) : null}
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

          <div className="pt-2 border-t border-border/70 text-xs opacity-70">
            Jeśli materiał jest w katalogu — kliknij w pozycję, żeby wejść w kartę materiału.
          </div>
        </div>
      </section>
    </main>
  );
}
