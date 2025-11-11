// app/reports/stages/page.tsx
import { supabase } from "@/lib/supabaseClient";

/**
 * Dane z widoku v_latest_stage_by_location_task
 * (najnowszy raport dla każdej pary location + task_name)
 */
type StageRow = {
  report_id: string;
  location: string;
  task_name: string;
  is_completed: boolean | null;
  approved: boolean | null;
  photos_count: number | null;
  date: string;
};

/** Oblicz wizualny progres */
function computeProgress(row: StageRow): number {
  if (row.approved) return 100;
  if (row.is_completed) return 90;
  if (row.photos_count && row.photos_count > 0) return 70;
  return 40;
}

async function fetchStages(params: {
  from?: string;
  to?: string;
  place?: string;
  q?: string;
}): Promise<StageRow[]> {
  let q1 = supabase
    .from("v_latest_stage_by_location_task")
    .select("*")
    .order("location", { ascending: true })
    .order("task_name", { ascending: true });

  // daty (filtr po dacie raportu)
  if (params.from) q1 = q1.gte("date", params.from);
  if (params.to) q1 = q1.lte("date", params.to);

  // filtr miejsca
  if (params.place && params.place !== "all") q1 = q1.eq("location", params.place);

  // szukaj po nazwie zadania lub ID raportu
  if (params.q && params.q.trim()) {
    const qText = params.q.trim();
    const byText = await supabase
      .from("v_latest_stage_by_location_task")
      .select("*")
      .or(`task_name.ilike.%${qText}%,location.ilike.%${qText}%,report_id.ilike.%${qText}%`)
      .order("location", { ascending: true })
      .order("task_name", { ascending: true });

    if (byText.error) return [];
    return (byText.data ?? []) as StageRow[];
  }

  const { data, error } = await q1;
  if (error) {
    console.error("fetchStages error:", error);
    return [];
  }
  return (data ?? []) as StageRow[];
}

export default async function Page({
  searchParams,
}: {
  searchParams?: { from?: string; to?: string; place?: string; q?: string };
}) {
  const params = {
    from: searchParams?.from,
    to: searchParams?.to,
    place: searchParams?.place,
    q: searchParams?.q,
  };

  const stages = await fetchStages(params);

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Etap projektu</h1>

      {/* FILTRY */}
      <form className="border rounded p-3 grid gap-3 md:grid-cols-5" method="get">
        <label className="text-sm">
          <span className="block text-zinc-400 mb-1">Od</span>
          <input
            type="date"
            name="from"
            defaultValue={searchParams?.from ?? ""}
            className="w-full border rounded p-2 bg-transparent"
          />
        </label>
        <label className="text-sm">
          <span className="block text-zinc-400 mb-1">Do</span>
          <input
            type="date"
            name="to"
            defaultValue={searchParams?.to ?? ""}
            className="w-full border rounded p-2 bg-transparent"
          />
        </label>
        <label className="text-sm">
          <span className="block text-zinc-400 mb-1">Miejsce</span>
          <select
            name="place"
            defaultValue={searchParams?.place ?? "all"}
            className="w-full border rounded p-2 bg-transparent"
          >
            <option value="all">Wszystkie</option>
            <option value="Plac A">Plac A</option>
            <option value="Plac B">Plac B</option>
            <option value="Plac C">Plac C</option>
          </select>
        </label>
        <label className="text-sm md:col-span-2">
          <span className="block text-zinc-400 mb-1">Szukaj (nazwa / ID / miejsce)</span>
          <input
            name="q"
            placeholder="np. Montaż profili"
            defaultValue={searchParams?.q ?? ""}
            className="w-full border rounded p-2 bg-transparent"
          />
        </label>

        <div className="flex items-end gap-2 md:col-span-5">
          <button className="px-3 py-2 border rounded" type="submit">
            Zastosuj
          </button>
          <a href="/reports/stages" className="px-3 py-2 border rounded">
            Wyczyść
          </a>
        </div>
      </form>

      {/* LISTA ETAPÓW */}
      <div className="border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-zinc-900">
            <tr>
              <th className="text-left p-2">Etap (zadanie)</th>
              <th className="text-left p-2">Miejsce</th>
              <th className="text-left p-2">Data raportu</th>
              <th className="text-left p-2">Progres</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Szczegóły</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-zinc-200/50 dark:divide-zinc-800">
            {stages.map((s) => {
              const pct = computeProgress(s);
              const status = s.approved
                ? "Skończone"
                : s.is_completed
                ? "Do zatwierdzenia"
                : "W toku";

              return (
                <tr key={s.report_id}>
                  <td className="p-2">{s.task_name ?? "—"}</td>
                  <td className="p-2">{s.location ?? "—"}</td>
                  <td className="p-2">{s.date}</td>
                  <td className="p-2 w-[260px]">
                    <div className="h-3 rounded bg-zinc-800/30">
                      <div
                        className="h-3 rounded bg-emerald-500"
                        style={{ width: `${pct}%` }}
                        aria-label={`Progres ${pct}%`}
                        role="progressbar"
                        title={`${pct}%`}
                      />
                    </div>
                    <div className="text-xs text-zinc-400 mt-1">{pct}%</div>
                  </td>
                  <td className="p-2 text-sm text-zinc-300">{status}</td>
                  <td className="p-2">
                    <a
                      className="px-2 py-1 border rounded"
                      href={`/reports/daily?location=${encodeURIComponent(
                        s.location ?? ""
                      )}&task=${encodeURIComponent(s.task_name ?? "")}`}
                    >
                      Otwórz raporty
                    </a>
                  </td>
                </tr>
              );
            })}

            {stages.length === 0 && (
              <tr>
                <td className="p-3 text-center text-gray-500" colSpan={6}>
                  Brak etapów (zmień filtry).
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
