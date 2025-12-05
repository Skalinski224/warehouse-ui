// app/reports/items/page.tsx
import { supabase } from "@/lib/supabaseClient";

type Row = {
  material_id: string;
  name: string | null;
  unit: string | null;
  image_url: string | null;
  base_quantity: number | null;
  current_quantity: number | null;
  total_ordered_qty: number | null;
  total_ordered_cost: number | null;
  last_delivery_at: string | null;
  last_usage_at: string | null;
};

function pct(numerator: number, denominator: number) {
  if (!denominator || denominator <= 0) return 0;
  return Math.max(0, Math.min(100, (numerator / denominator) * 100));
}

export default async function Page({
  searchParams,
}: {
  searchParams?: {
    from?: string; // YYYY-MM-DD
    to?: string;   // YYYY-MM-DD
    q?: string;
    low?: "on" | "off"; // checkbox
  };
}) {
  const from = searchParams?.from || "";
  const to = searchParams?.to || "";
  const q = (searchParams?.q || "").trim();
  const onlyLow = searchParams?.low === "on";

  // RPC z parametrami (null gdy brak)
  const { data, error } = await supabase.rpc("items_overview", {
    from_date: from || null,
    to_date: to || null,
    q: q || null,
  });

  const rows = (data as Row[] | null) ?? [];
  if (error) {
    console.warn("items_overview error:", error.message ?? error);
  }

  // Filtrowanie "Tylko low stock" po stronie klienta:
  // low stock: current_quantity <= 25% base_quantity (jeśli base_quantity > 0)
  const filtered = rows.filter((r) => {
    if (!onlyLow) return true;
    const base = r.base_quantity ?? 0;
    const cur = r.current_quantity ?? 0;
    if (base <= 0) return false;
    return cur <= 0.25 * base;
  });

  const fmt = new Intl.NumberFormat("pl-PL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const dt = (s: string | null) =>
    s ? new Date(s).toLocaleString("pl-PL") : "—";

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold"> Wszystkie przedmioty</h1>

      {/* FILTRY */}
      <form className="border rounded p-3 grid gap-3 md:grid-cols-6" method="get">
        <label className="text-sm">
          <span className="block text-zinc-400 mb-1">Od</span>
          <input
            type="date"
            name="from"
            defaultValue={from}
            className="w-full border rounded p-2 bg-transparent"
          />
        </label>

        <label className="text-sm">
          <span className="block text-zinc-400 mb-1">Do</span>
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="w-full border rounded p-2 bg-transparent"
          />
        </label>

        <label className="text-sm md:col-span-3">
          <span className="block text-zinc-400 mb-1">Szukaj (nazwa)</span>
          <input
            name="q"
            placeholder="np. Kontownik stalowy"
            defaultValue={q}
            className="w-full border rounded p-2 bg-transparent"
          />
        </label>

        <label className="flex items-center gap-2 md:col-span-6 text-sm">
          <input type="checkbox" name="low" defaultChecked={onlyLow} />
          <span>Tylko low stock (≤ 25% stanu bazowego)</span>
        </label>

        <div className="flex items-end gap-2 md:col-span-6">
          <button className="px-3 py-2 border rounded" type="submit">
            Zastosuj
          </button>
          <a href="/reports/items" className="px-3 py-2 border rounded">
            Wyczyść
          </a>
        </div>
      </form>

      {/* LISTA KART */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((r) => {
          const cur = r.current_quantity ?? 0;
          const totalOrdered = r.total_ordered_qty ?? 0;
          const percentOfOrdered = pct(cur, totalOrdered);

          return (
            <div
              key={r.material_id}
              className="border rounded p-3 flex gap-3 items-start"
            >
              <div className="w-16 h-16 shrink-0 rounded overflow-hidden bg-zinc-900/40 flex items-center justify-center">
                {r.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.image_url}
                    alt={r.name ?? ""}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xs text-zinc-500">brak</span>
                )}
              </div>

              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{r.name ?? "—"}</div>
                  <div className="text-xs text-zinc-400">{r.unit ?? "—"}</div>
                </div>

                {/* Stan: AKTUALNIE / ZAMÓWIONO ŁĄCZNIE (+ %) */}
                <div className="text-sm">
                  <div>
                    <span className="text-zinc-400">Aktualnie:</span>{" "}
                    <span className="font-mono">{cur}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400">Zamówiono łącznie (w zakresie):</span>{" "}
                    <span className="font-mono">{totalOrdered}</span>
                    {totalOrdered > 0 && (
                      <span className="ml-2 text-xs text-zinc-400">
                        ({percentOfOrdered.toFixed(0)}% aktualnego vs zamówione)
                      </span>
                    )}
                  </div>
                </div>

                {/* Ostatnie zdarzenia */}
                <div className="text-xs text-zinc-400">
                  <div>Ostatnia dostawa: {dt(r.last_delivery_at)}</div>
                  <div>Ostatnie zużycie: {dt(r.last_usage_at)}</div>
                </div>

                {/* Koszt łączny */}
                <div className="text-sm">
                  <span className="text-zinc-400">Łączny koszt:</span>{" "}
                  <span className="font-mono">
                    {fmt.format(r.total_ordered_cost ?? 0)} PLN
                  </span>
                </div>

                {/* Pasek procentowy względem zamówionych (jeśli ma sens) */}
                {totalOrdered > 0 && (
                  <div className="mt-2 h-2 w-full bg-zinc-800 rounded">
                    <div
                      className="h-2 bg-zinc-200 rounded"
                      style={{ width: `${percentOfOrdered}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="md:col-span-2 lg:col-span-3 text-sm text-zinc-500">
            Brak wyników (zmień filtry).
          </div>
        )}
      </div>
    </main>
  );
}
