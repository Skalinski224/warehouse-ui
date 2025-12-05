// src/app/(app)/reports/deliveries/page.tsx
// Server Component – raport dostaw

import ApproveButton from "@/components/ApproveButton";
import { approveDelivery } from "@/lib/actions";
import { supabaseServer } from "@/lib/supabaseServer";
import { getInvoiceSignedUrl } from "@/lib/uploads/invoices";

type Row = {
  id: string;
  date: string | null;
  created_at: string | null;
  place_label: string | null;
  person: string | null;
  supplier: string | null;
  delivery_cost: number | null;
  materials_cost: number | null;
  items: any[] | null; // JSONB z pozycjami
  approved: boolean | null;
  deleted_at: string | null;
  invoice_url: string | null; // PATH w buckecie
};

type UiRow = Row & {
  invoice_href: string | null; // gotowy signed URL (albo null gdy nie da się wygenerować)
};

type StatusFilter = "all" | "pending" | "approved";

type FetchParams = {
  from?: string;
  to?: string;
  person?: string;
  status?: StatusFilter;
  q?: string;
};

function isLikelyId(s: string) {
  // prosta detekcja UUID / id
  return /^[0-9a-f-]{8,}$/i.test(s);
}

async function fetchRows(params: FetchParams): Promise<Row[]> {
  const supabase = await supabaseServer();

  let q = supabase
    .from("deliveries")
    .select(
      [
        "id",
        "date",
        "created_at",
        "place_label",
        "person",
        "supplier",
        "delivery_cost",
        "materials_cost",
        "items",
        "approved",
        "deleted_at",
        "invoice_url",
      ].join(", ")
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (params.from) q = q.gte("date", params.from);
  if (params.to) q = q.lte("date", params.to);

  if (params.person && params.person.trim()) {
    const p = params.person.trim();
    q = q.ilike("person", `%${p}%`);
  }

  if (params.status === "approved") q = q.eq("approved", true);
  if (params.status === "pending") q = q.eq("approved", false);

  if (params.q && params.q.trim()) {
    const s = params.q.trim();
    if (isLikelyId(s)) {
      q = q.eq("id", s);
    } else {
      // prosty OR po kilku kolumnach
      q = q.or(
        `person.ilike.%${s}%,place_label.ilike.%${s}%,supplier.ilike.%${s}%`
      );
    }
  }

  const { data, error } = (await q) as {
    data: Row[] | null;
    error: any;
  };

  if (error) {
    console.warn("reports/deliveries error:", error.message ?? error);
    return [];
  }

  return data ?? [];
}

type SearchParams = {
  [key: string]: string | string[] | undefined;
};

export default async function Page({
  // w Next 15 searchParams jest Promise
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = (await searchParams) ?? {};

  const get = (key: string): string | undefined => {
    const v = sp[key];
    if (Array.isArray(v)) return v[0];
    return v ?? undefined;
  };

  const params: FetchParams = {
    from: get("from"),
    to: get("to"),
    person: get("person"),
    status: (get("status") as StatusFilter | undefined) ?? "all",
    q: get("q"),
  };

  const rows = await fetchRows(params);

  // Ten klient służy tylko do generowania signed URLi do faktur
  const supabaseForInvoices = await supabaseServer();

  const uiRows: UiRow[] = await Promise.all(
    rows.map(async (r) => {
      let invoice_href: string | null = null;

      if (r.invoice_url) {
        try {
          invoice_href = await getInvoiceSignedUrl({
            supabase: supabaseForInvoices,
            path: r.invoice_url,
          });
        } catch (e) {
          console.warn(
            "reports/deliveries: getInvoiceSignedUrl error:",
            (e as Error)?.message ?? e
          );
        }
      }

      return { ...r, invoice_href };
    })
  );

  const fmtCurrency = new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 2,
  });

  const fmtDateTime = (iso: string | null): string => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("pl-PL");
  };

  return (
    <main className="p-6 space-y-6">
      {/* HEADER */}
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Raport: dostawy</h1>
        <p className="text-sm opacity-70">
          Zestawienie wszystkich dostaw dodanych w aplikacji. Możesz filtrować
          po dacie, osobie, statusie i wyszukiwać po ID / osobie / miejscu /
          dostawcy.
        </p>
      </header>

      {/* FILTRY (GET) */}
      <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <h2 className="text-sm font-medium opacity-80">Filtry</h2>

        <form className="grid gap-3 md:grid-cols-6 text-xs" method="get">
          <label className="flex flex-col gap-1">
            <span className="opacity-70">Od</span>
            <input
              type="date"
              name="from"
              defaultValue={params.from ?? ""}
              className="w-full rounded border border-border bg-background px-2 py-1"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="opacity-70">Do</span>
            <input
              type="date"
              name="to"
              defaultValue={params.to ?? ""}
              className="w-full rounded border border-border bg-background px-2 py-1"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="opacity-70">Osoba zgłaszająca</span>
            <input
              name="person"
              placeholder="np. magazynier"
              defaultValue={params.person ?? ""}
              className="w-full rounded border border-border bg-background px-2 py-1"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="opacity-70">Status</span>
            <select
              name="status"
              defaultValue={params.status ?? "all"}
              className="w-full rounded border border-border bg-background px-2 py-1"
            >
              <option value="all">Wszystkie</option>
              <option value="pending">Tylko oczekujące</option>
              <option value="approved">Tylko zatwierdzone</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="opacity-70">Szukaj (ID / osoba / miejsce)</span>
            <input
              name="q"
              placeholder="np. #id, nazwisko, plac"
              defaultValue={params.q ?? ""}
              className="w-full rounded border border-border bg-background px-2 py-1"
            />
          </label>

          <div className="flex items-end gap-2 md:col-span-6">
            <button
              className="px-3 py-2 rounded border border-border bg-foreground text-background text-xs font-medium hover:bg-foreground/90"
              type="submit"
            >
              Zastosuj filtry
            </button>
            <a
              href="/reports/deliveries"
              className="px-3 py-2 rounded border border-border bg-background text-xs hover:bg-background/80"
            >
              Wyczyść
            </a>
          </div>
        </form>
      </section>

      {/* LISTA DOSTAW */}
      <section className="space-y-3">
        <div className="flex items-center justify-between text-xs opacity-70">
          <span>Wyników: {uiRows.length}</span>
          <span>
            Pokazuję maksymalnie 100 rekordów, posortowane od najnowszych.
          </span>
        </div>

        {uiRows.length === 0 && (
          <div className="rounded-2xl border border-border bg-card p-4 text-sm opacity-70">
            Brak wyników – zmień zakres dat lub inne filtry.
          </div>
        )}

        {uiRows.length > 0 && (
          <div className="space-y-2">
            {uiRows.map((r) => {
              const itemsCount = Array.isArray(r.items) ? r.items.length : 0;
              const total =
                (r.materials_cost ?? 0) + (r.delivery_cost ?? 0);

              const baseDate = r.date ?? r.created_at;
              const placeLabel = r.place_label || "brak miejsca";
              const personLabel = r.person || "nie podano osoby";
              const supplierLabel = r.supplier || "";

              return (
                <article
                  key={r.id}
                  className="rounded-2xl border border-border bg-card px-4 py-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
                >
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-2">
                      <a
                        href={`/reports/deliveries/${r.id}`}
                        className="font-mono text-[11px] underline underline-offset-2"
                      >
                        #{r.id.slice(0, 8)}
                      </a>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] ${
                          r.approved
                            ? "bg-emerald-600/20 text-emerald-300 border border-emerald-500/40"
                            : "bg-amber-600/20 text-amber-300 border border-amber-500/40"
                        }`}
                      >
                        {r.approved ? "zatwierdzona" : "oczekująca"}
                      </span>
                      <span className="text-[10px] opacity-70">
                        pozycji: {itemsCount}
                      </span>
                    </div>

                    <div className="opacity-80">
                      {placeLabel} • {fmtDateTime(baseDate ?? null)}
                    </div>

                    <div className="opacity-70">
                      {personLabel}
                      {supplierLabel && ` • ${supplierLabel}`}
                    </div>

                    <div className="flex flex-wrap gap-2 text-[11px] pt-1">
                      <span className="opacity-75">
                        Materiały:{" "}
                        <strong className="opacity-100">
                          {fmtCurrency.format(r.materials_cost ?? 0)}
                        </strong>
                      </span>
                      <span className="opacity-75">
                        Dostawa:{" "}
                        <strong className="opacity-100">
                          {fmtCurrency.format(r.delivery_cost ?? 0)}
                        </strong>
                      </span>
                      <span className="opacity-75">
                        Razem:{" "}
                        <strong className="opacity-100">
                          {fmtCurrency.format(total)}
                        </strong>
                      </span>
                      {r.invoice_href && (
                        <a
                          href={r.invoice_href}
                          target="_blank"
                          rel="noreferrer"
                          className="underline underline-offset-2 opacity-80 hover:opacity-100"
                        >
                          Faktura / dokument
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    {!r.approved && (
                      <form action={approveDelivery}>
                        <input
                          type="hidden"
                          name="delivery_id"
                          value={r.id}
                        />
                        <ApproveButton>Akceptuj</ApproveButton>
                      </form>
                    )}

                    <a
                      href={`/reports/deliveries/${r.id}`}
                      className="px-3 py-1 rounded border border-border bg-background text-xs hover:bg-background/80"
                    >
                      Szczegóły
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
