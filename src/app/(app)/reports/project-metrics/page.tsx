// app/reports/project-metrics/page.tsx
// Server Component

import { supabase } from "@/lib/supabaseClient";

type TopUsageItem = {
  material_id: string;
  name: string | null;
  unit: string | null;
  image_url: string | null;
  total_used: number | null;
};

type Metrics = {
  total_materials_cost: number;
  total_delivery_cost: number;
  used_qty_sum: number;
  daily_reports_count: number;
  pending_reports_count: number;
  avg_approval_hours: number;
  low_stock_count: number;
  within_plan_count: number;
  over_plan_count: number;
  top_usage: TopUsageItem[];
};

function MetricCard({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <div className="border rounded-xl p-4 shadow-sm bg-zinc-950/40">
      <div className="text-xs uppercase tracking-wide text-zinc-400">{title}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {hint && <div className="mt-1 text-xs text-zinc-500">{hint}</div>}
    </div>
  );
}

export default async function Page({
  searchParams,
}: {
  searchParams?: { from?: string; to?: string; place?: string }; // 'place' -> mapujemy na SQL param 'in_place' (location)
}) {
  const from = (searchParams?.from ?? "").trim();
  const to = (searchParams?.to ?? "").trim();
  const place = (searchParams?.place ?? "").trim();

  // RPC zgodne z: project_metrics(from_date, to_date, in_place)
  const { data, error } = await supabase.rpc("project_metrics", {
    from_date: from || null,
    to_date: to || null,
    in_place: place || null, // filtruje po daily_reports.location
  });

  if (error) {
    console.warn("project_metrics error:", error.message ?? error);
  }

  // Supabase potrafi zwrócić array z jednym rekordem; bezpieczne rozpakowanie:
  const row = Array.isArray(data) ? data[0] : data;
  const m: Metrics = {
    total_materials_cost: Number(row?.total_materials_cost ?? 0),
    total_delivery_cost: Number(row?.total_delivery_cost ?? 0),
    used_qty_sum: Number(row?.used_qty_sum ?? 0),
    daily_reports_count: Number(row?.daily_reports_count ?? 0),
    pending_reports_count: Number(row?.pending_reports_count ?? 0),
    avg_approval_hours: Number(row?.avg_approval_hours ?? 0),
    low_stock_count: Number(row?.low_stock_count ?? 0),
    within_plan_count: Number(row?.within_plan_count ?? 0),
    over_plan_count: Number(row?.over_plan_count ?? 0),
    top_usage: (row?.top_usage as TopUsageItem[] | undefined) ?? [],
  };

  const fmtCur = new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    minimumFractionDigits: 2,
  });
  const fmtNum = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 2 });

  const totalAllCost = (m.total_materials_cost || 0) + (m.total_delivery_cost || 0);

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Projekt w liczbach</h1>

      {/* FILTRY (zgodne z założeniami, bez Brygady/Statusu) */}
      <form className="border rounded p-3 grid gap-3 md:grid-cols-6" method="get">
        <label className="text-sm">
          <span className="block text-zinc-400 mb-1">Od</span>
          <input type="date" name="from" defaultValue={from} className="w-full border rounded p-2 bg-transparent" />
        </label>
        <label className="text-sm">
          <span className="block text-zinc-400 mb-1">Do</span>
          <input type="date" name="to" defaultValue={to} className="w-full border rounded p-2 bg-transparent" />
        </label>
        <label className="text-sm md:col-span-4">
          <span className="block text-zinc-400 mb-1">Miejsce (opcjonalnie)</span>
          <input
            name="place"
            placeholder="np. Hala A / Sektor B"
            defaultValue={place}
            className="w-full border rounded p-2 bg-transparent"
          />
        </label>
        <div className="flex items-end gap-2 md:col-span-6">
          <button className="px-3 py-2 border rounded" type="submit">Zastosuj</button>
          <a href="/reports/project-metrics" className="px-3 py-2 border rounded">Wyczyść</a>
        </div>
      </form>

      {/* KAFLE KPI */}
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        <MetricCard title="Łączny koszt materiałów" value={fmtCur.format(m.total_materials_cost)} />
        <MetricCard title="Koszt dostaw" value={fmtCur.format(m.total_delivery_cost)} />
        <MetricCard title="SUMA zużyć (szt.)" value={fmtNum.format(m.used_qty_sum)} />
        <MetricCard
          title="Raporty dzienne"
          value={`${m.daily_reports_count}`}
          hint={`Pending: ${m.pending_reports_count}`}
        />
        <MetricCard
          title="Śr. czas zatwierdzenia"
          value={`${fmtNum.format(m.avg_approval_hours)} h`}
          hint="Przybliżenie: od utworzenia do teraz"
        />
        <MetricCard title="Low stock (≤25%)" value={`${m.low_stock_count}`} />
      </div>

      {/* Dodatkowe kafle zgodnie z założeniami */}
      <div className="grid gap-3 md:grid-cols-2">
        <MetricCard title="Łączny koszt (materiały + dostawy)" value={fmtCur.format(totalAllCost)} />
        <MetricCard
          title="Plan projektanta vs rzeczywistość"
          value={`W planie: ${m.within_plan_count} • Przekroczone: ${m.over_plan_count}`}
          hint="Porównanie po rodzinach (family_key)"
        />
      </div>

      {/* TOP 5 wg zużycia */}
      <section className="space-y-2">
        <h2 className="text-lg font-medium">Top 5 materiałów wg zużycia</h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {m.top_usage.map((t) => (
            <div key={t.material_id} className="border rounded p-3 flex gap-3 items-start">
              <div className="w-12 h-12 rounded overflow-hidden bg-zinc-900/40 flex items-center justify-center">
                {t.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.image_url} alt={t.name ?? ""} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs text-zinc-500">brak</span>
                )}
              </div>
              <div className="flex-1">
                <div className="font-medium">{t.name ?? "—"}</div>
                <div className="text-xs text-zinc-400">{t.unit ?? "—"}</div>
                <div className="mt-1 text-sm">
                  Zużyto: <span className="font-mono">{fmtNum.format(t.total_used ?? 0)}</span>
                </div>
              </div>
            </div>
          ))}
          {m.top_usage.length === 0 && (
            <div className="text-sm text-zinc-500">Brak danych zużycia w tym zakresie.</div>
          )}
        </div>
      </section>
    </main>
  );
}
