// src/app/(app)/reports/deliveries/[id]/page.tsx

import { supabaseServer } from "@/lib/supabaseServer";
import { getInvoiceSignedUrl } from "@/lib/uploads/invoices";

type DeliveryRow = {
  id: string;
  date: string | null;
  created_at: string | null;
  person: string | null;
  delivery_cost: number | null;
  materials_cost: number | null;
  invoice_url: string | null; // przechowujemy PATH w buckecie invoices
  items: any[] | null; // JSONB z pozycjami dostawy
  approved: boolean | null;
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

export default async function Page({
  params,
}: {
  // 👇 ważne: w Next 15 params jest Promise
  params: Promise<{ id: string }>;
}) {
  // 0) Rozpakuj params (fix błędu "params is a Promise")
  const { id } = await params;

  const supabase = await supabaseServer();

  // 1) Pobierz dostawę
  const { data: delivery, error: dErr } = await supabase
    .from("deliveries")
    .select(
      "id, date, created_at, person, delivery_cost, materials_cost, invoice_url, items, approved"
    )
    .eq("id", id)
    .maybeSingle<DeliveryRow>();

  if (dErr || !delivery) {
    console.warn("reports/deliveries/[id] error:", dErr?.message ?? dErr);
    return (
      <main className="p-6">
        <h1 className="text-xl font-semibold mb-2">
          Dostawa nie została znaleziona
        </h1>
        <p className="text-sm opacity-70">
          Sprawdź, czy adres jest poprawny lub wróć do listy dostaw.
        </p>
        <a
          href="/reports/deliveries"
          className="mt-4 inline-flex text-sm underline underline-offset-2 opacity-80 hover:opacity-100"
        >
          ← Wróć do raportu dostaw
        </a>
      </main>
    );
  }

  const d = delivery as DeliveryRow;

  // 2) Surowe pozycje z JSONB (kompatybilne klucze: qty|quantity, unit_price|price)
  const rawItems: any[] = Array.isArray(d.items) ? d.items : [];

  // Wyciągamy material_id, żeby dociągnąć tytuły / jednostki
  const materialIds = Array.from(
    new Set(
      rawItems
        .map((it) => it.material_id as string | undefined)
        .filter(Boolean) as string[]
    )
  );

  let materialsById: Record<string, { title: string; unit: string | null }> =
    {};

  if (materialIds.length > 0) {
    const { data: mats, error: mErr } = await supabase
      .from("materials")
      .select("id, title, unit")
      .in("id", materialIds);

    if (mErr) {
      console.warn(
        "reports/deliveries/[id] materials error:",
        mErr.message ?? mErr
      );
    } else if (mats) {
      materialsById = Object.fromEntries(
        mats.map((m) => [m.id, { title: m.title, unit: m.unit }])
      );
    }
  }

  // 3) Budujemy pozycje do UI
  const uiItems: UiItem[] = rawItems.map((it, idx) => {
    const qtyRaw = it.qty ?? it.quantity ?? 0;
    const qty = Number(qtyRaw) || 0;

    const priceRaw = it.unit_price ?? it.price ?? 0;
    const unitPrice = Number(priceRaw) || 0;

    const value = qty * unitPrice;

    const materialId: string | null = it.material_id ?? null;
    const meta = materialId ? materialsById[materialId] : undefined;

    const materialTitle =
      meta?.title ?? materialId ?? "Nieznany materiał (brak w katalogu)";
    const unit = meta?.unit ?? null;

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
  const dateLabel = baseDate
    ? new Date(baseDate).toLocaleString("pl-PL")
    : "—";

  const money = new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 2,
  });

  // 4) Podpisany URL do faktury (jeśli mamy path w invoice_url)
  const invoiceHref = d.invoice_url
    ? await getInvoiceSignedUrl({ supabase, path: d.invoice_url })
    : null;

  return (
    <main className="p-6 space-y-6">
      {/* HEADER */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            Dostawa <span className="font-mono">#{d.id.slice(0, 8)}</span>
          </h1>
          <p className="text-sm opacity-70">
            Szczegóły pojedynczej dostawy – koszty, pozycje oraz podpięta
            faktura.
          </p>
        </div>

        <a
          href="/reports/deliveries"
          className="text-sm underline underline-offset-2 opacity-80 hover:opacity-100"
        >
          ← Wróć do raportu dostaw
        </a>
      </header>

      {/* PODSUMOWANIE */}
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
          <h2 className="text-sm font-medium">Podsumowanie</h2>
          <div className="mt-1 text-sm space-y-1.5">
            <div>
              <span className="opacity-60">Data zgłoszenia: </span>
              <span>{dateLabel}</span>
            </div>
            <div>
              <span className="opacity-60">Zgłaszający: </span>
              <span>{d.person || "nie podano"}</span>
            </div>
            <div>
              <span className="opacity-60">Status: </span>
              <span className={d.approved ? "text-emerald-400" : "text-amber-400"}>
                {d.approved ? "zatwierdzona" : "oczekuje na akceptację"}
              </span>
            </div>
            <div className="pt-2 border-t border-border/70 mt-2 space-y-1">
              <div>
                <span className="opacity-60">Koszt materiałów: </span>
                <span>{money.format(materialsCost)}</span>
              </div>
              <div>
                <span className="opacity-60">Koszt dostawy / transportu: </span>
                <span>{money.format(deliveryCost)}</span>
              </div>
              <div>
                <span className="opacity-60">Razem: </span>
                <span className="font-semibold">
                  {money.format(grand)}
                </span>
              </div>
            </div>
            <div className="pt-2 border-t border-border/70 mt-2">
              <span className="opacity-60">Faktura / dokument: </span>
              {invoiceHref ? (
                <a
                  href={invoiceHref}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2 opacity-90 hover:opacity-100"
                >
                  otwórz w nowej karcie
                </a>
              ) : d.invoice_url ? (
                <span className="opacity-70">
                  nie udało się wygenerować linku – spróbuj ponownie później
                </span>
              ) : (
                <span>brak podpiętego pliku</span>
              )}
            </div>
          </div>
        </div>

        {/* SZYBKI PODGLĄD POZYCJI */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
          <h2 className="text-sm font-medium">
            Pozycje w dostawie ({uiItems.length})
          </h2>
          <p className="text-xs opacity-70">
            Dane pochodzą z formularza „Nowe dostawy”. Idą 1:1 do raportów
            magazynowych i aktualizacji stanów po akceptacji dostawy.
          </p>
          <div className="mt-3 max-h-64 overflow-auto text-xs">
            <table className="w-full border-collapse">
              <thead className="border-b border-border/70 text-[11px] uppercase tracking-wide opacity-70">
                <tr>
                  <th className="text-left py-1 pr-2">Materiał</th>
                  <th className="text-right py-1 px-2">Ilość</th>
                  <th className="text-right py-1 px-2">Cena / j.</th>
                  <th className="text-right py-1 pl-2">Wartość</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {uiItems.map((it) => (
                  <tr key={it.key}>
                    <td className="py-1 pr-2 align-top">
                      <div className="font-medium">{it.materialTitle}</div>
                      {it.materialId && (
                        <div className="font-mono text-[10px] opacity-60">
                          {it.materialId}
                        </div>
                      )}
                    </td>
                    <td className="py-1 px-2 text-right whitespace-nowrap">
                      {it.quantity.toLocaleString("pl-PL")}{" "}
                      {it.unit ? (
                        <span className="opacity-60">{it.unit}</span>
                      ) : null}
                    </td>
                    <td className="py-1 px-2 text-right whitespace-nowrap">
                      {it.unitPrice ? money.format(it.unitPrice) : "—"}
                    </td>
                    <td className="py-1 pl-2 text-right whitespace-nowrap">
                      {money.format(it.value)}
                    </td>
                  </tr>
                ))}

                {uiItems.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-3 text-center opacity-60 text-xs"
                    >
                      Brak pozycji w tej dostawie (pusta lista materiałów).
                    </td>
                  </tr>
                )}
              </tbody>
              {uiItems.length > 0 && (
                <tfoot className="border-t border-border/70 text-xs">
                  <tr>
                    <td className="py-1 pr-2 text-right font-medium" colSpan={3}>
                      Suma pozycji
                    </td>
                    <td className="py-1 pl-2 text-right font-semibold">
                      {money.format(itemsTotal)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}
