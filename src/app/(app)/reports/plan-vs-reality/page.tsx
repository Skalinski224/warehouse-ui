// app/reports/plan-vs-reality/page.tsx
// Server Component

import { supabase } from "@/lib/supabaseClient";

type Stage = { id: string; name: string | null; planned_start: string | null };
type Family = { family_key: string | null };

type Row = {
  stage_id: string | null;
  stage_name: string | null;
  family_key: string | null;
  planned_qty: number | null;
  planned_cost: number | null;
  real_qty: number | null;
  real_cost: number | null;
  deviation_pct: number | null;
};

function colorForDeviation(pct: number | null) {
  if (pct === null || pct === undefined) return "bg-zinc-700";
  const a = Math.abs(pct);
  if (a <= 5) return "bg-green-600";
  if (a <= 15) return "bg-yellow-600";
  return "bg-red-600";
}

export default async function Page({
  searchParams,
}: {
  searchParams?: {
    from?: string;
    to?: string;
    stage?: string;   // stage_id
    family?: string;  // family_key
  };
}) {
  const from = searchParams?.from?.trim() ?? "";
  const to = searchParams?.to?.trim() ?? "";
  const stage = searchParams?.stage?.trim() ?? "";
  const family = searchParams?.family?.trim() ?? "";

  // Etapy — sortuj po planned_start, potem name (bo nie masz kolumny 'position')
  const { data: stages, error: stagesErr } = await supabase
    .from("project_stages")
    .select("id, name, planned_start")
    .order("planned_start", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });

  if (stagesErr) console.warn("stages error:", stagesErr.message ?? stagesErr);

  // Rodziny materiałów (distinct robimy w JS — supabase distinct bywa kapryśny)
  const { data: fams, error: famsErr } = await supabase
    .from("materials")
    .select("family_key")
    .not("family_key", "is", null)
    .order("family_key", { ascending: true });

  if (famsErr) console.warn("families error:", famsErr.message ?? famsErr);
  const familyOptions = Array.from(
    new Set(((fams as Family[] | null) ?? []).map((f) => f.family_key).filter(Boolean))
  ).map(String);

  // Główne dane z RPC (parametry muszą się nazywać jak w SQL)
  const { data, error } = await supabase.rpc("designer_vs_real", {
    from_date: from || null,
    to_date: to || null,
    in_stage_id: stage || null,
    in_family: family || null,
  });
  if (error) console.warn("designer_vs_real error:", error.message ?? error);

  const rows: Row[] = (data as any) ?? [];

  const fmtNum = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 2 });
  const fmtCur = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold"> Projektant vs rzeczywistość</h1>

      {/* FILTRY */}
      <form className="border rounded p-3 grid gap-3 md:grid-cols-6" method="get">
        <label className="text-sm md:col-span-2">
          <span className="block text-zinc-400 mb-1">Etap</span>
          <select name="stage" defaultValue={stage} className="w-full border rounded p-2 bg-transparent">
            <option value="">Wszystkie</option>
            {(stages as Stage[] | null)?.map((s) => (
              <option key={s.id} value={s.id ?? ""}>
                {s.name ?? "—"}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm md:col-span-2">
          <span className="block text-zinc-400 mb-1">Materiał (rodzina)</span>
          <select name="family" defaultValue={family} className="w-full border rounded p-2 bg-transparent">
            <option value="">Wszystkie</option>
            {familyOptions.map((fk) => (
              <option key={fk} value={fk}>
                {fk}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="block text-zinc-400 mb-1">Od</span>
          <input type="date" name="from" defaultValue={from} className="w-full border rounded p-2 bg-transparent" />
        </label>

        <label className="text-sm">
          <span className="block text-zinc-400 mb-1">Do</span>
          <input type="date" name="to" defaultValue={to} className="w-full border rounded p-2 bg-transparent" />
        </label>

        <div className="flex items-end gap-2 md:col-span-6">
          <button className="px-3 py-2 border rounded" type="submit">Zastosuj</button>
          <a href="/reports/plan-vs-reality" className="px-3 py-2 border rounded">Wyczyść</a>
        </div>
      </form>

      {/* TABELA */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-zinc-400">
            <tr className="border-b">
              <th className="py-2 pr-3">Materiał (rodzina)</th>
              <th className="py-2 pr-3">Etap</th>
              <th className="py-2 pr-3">Plan ilość</th>
              <th className="py-2 pr-3">Plan koszt</th>
              <th className="py-2 pr-3">Rzecz. ilość</th>
              <th className="py-2 pr-3">Rzecz. koszt</th>
              <th className="py-2 pr-3">Odchylenie</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const dev = r.deviation_pct ?? null;
              const bar = colorForDeviation(dev);
              return (
                <tr key={`${r.family_key ?? "null"}:${r.stage_id ?? "null"}:${i}`} className="border-b hover:bg-zinc-900/40">
                  <td className="py-2 pr-3 font-medium">{r.family_key ?? "—"}</td>
                  <td className="py-2 pr-3">{r.stage_name ?? "—"}</td>
                  <td className="py-2 pr-3 font-mono">{fmtNum.format(r.planned_qty ?? 0)}</td>
                  <td className="py-2 pr-3 font-mono">{fmtCur.format(r.planned_cost ?? 0)} PLN</td>
                  <td className="py-2 pr-3 font-mono">{fmtNum.format(r.real_qty ?? 0)}</td>
                  <td className="py-2 pr-3 font-mono">{fmtCur.format(r.real_cost ?? 0)} PLN</td>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono">
                        {dev === null ? "—" : `${dev.toFixed(1)}%`}
                      </span>
                      <span className={`inline-block h-2 w-10 rounded ${bar}`} />
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td className="py-4 text-zinc-500" colSpan={7}>
                  Brak danych (zmień filtry lub uzupełnij plany/rodziny materiałów).
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* TODO: wykres (Plan vs Real) – mogę dorzucić Recharts na tej samej stronie */}
    </main>
  );
}
