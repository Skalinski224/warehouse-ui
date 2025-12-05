// app/reports/daily/page.tsx
import { supabase } from "@/lib/supabaseClient";
import { approveDailyReport } from "@/lib/actions";
import ApproveButton from "@/components/ApproveButton";

type ReportItem = { material_name: string | null; quantity_used: number | null };

type ReportRow = {
  id: string;
  crew_name: string | null;          // <- schemat: crew_name
  location: string | null;           // <- schemat: location
  task_name: string | null;
  items: ReportItem[] | null;        // jsonb array
  images: string[] | null;           // text[] lub varchar[]
  photos_count: number | null;       // computed lub null
  is_completed: boolean | null;
  approved: boolean | null;          // <- schemat: approved (zamiast status)
  date: string;                      // YYYY-MM-DD
};

function toStatusText(r: ReportRow) {
  if (r.approved) return "approved";
  if (r.is_completed) return "pending"; // np. ukończony, ale niezatwierdzony
  return "in-progress";
}

async function fetchReports(params: {
  date_from?: string;
  date_to?: string;
  crew?: string;
  place?: string;
  status?: "all" | "pending" | "approved" | "in-progress";
  q?: string;
}): Promise<ReportRow[]> {
  // bazowy select zgodny z Twoim schematem
  let query = supabase
    .from("daily_reports")
    .select(
      "id, crew_name, location, task_name, items, images, photos_count, is_completed, approved, date"
    )
    .order("date", { ascending: false })
    .limit(100);

  // daty
  if (params.date_from) query = query.gte("date", params.date_from);
  if (params.date_to) query = query.lte("date", params.date_to);

  // filtry proste (crew_name / location)
  if (params.crew && params.crew !== "all") query = query.eq("crew_name", params.crew);
  if (params.place && params.place !== "all") query = query.eq("location", params.place);

  // status -> mapowanie na approved / is_completed
  if (params.status && params.status !== "all") {
    if (params.status === "approved") {
      query = query.eq("approved", true);
    } else if (params.status === "pending") {
      // ukończone, czeka na zatwierdzenie
      query = query.eq("approved", false).eq("is_completed", true);
    } else if (params.status === "in-progress") {
      // w toku (nieukończone)
      query = query.eq("is_completed", false);
    }
  }

  // q: szukaj po id / crew_name / location / task_name
  if (params.q && params.q.trim()) {
    const q = params.q.trim();
    // Uwaga: .or() obejmuje tylko ten jeden select – robimy alternatywy w jednym OR
    query = query.or(
      `id.ilike.%${q}%,crew_name.ilike.%${q}%,location.ilike.%${q}%,task_name.ilike.%${q}%`
    );
  }

  const { data, error } = await query;
  if (error) return [];
  return (data ?? []) as ReportRow[];
}

export default async function Page({
  searchParams,
}: {
  searchParams?: {
    from?: string;
    to?: string;
    crew?: string;
    place?: string;
    status?: "all" | "pending" | "approved" | "in-progress";
    q?: string;
  };
}) {
  const params = {
    date_from: searchParams?.from,
    date_to: searchParams?.to,
    crew: searchParams?.crew,
    place: searchParams?.place,
    status: (searchParams?.status as any) ?? "all",
    q: searchParams?.q,
  };

  const reports = await fetchReports(params);

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Raporty dzienne</h1>

      {/* FILTRY – GET (Server Component friendly) */}
      <form className="border rounded p-3 grid gap-3 md:grid-cols-6" method="get">
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
          <span className="block text-zinc-400 mb-1">Brygada</span>
          <select
            name="crew"
            defaultValue={searchParams?.crew ?? "all"}
            className="w-full border rounded p-2 bg-transparent"
          >
            <option value="all">Wszystkie</option>
            {/* jeśli masz słownik brygad, podstaw z bazy; na razie ręcznie */}
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
            <option value="D">D</option>
          </select>
        </label>

        <label className="text-sm">
          <span className="block text-zinc-400 mb-1">Miejsce</span>
          <select
            name="place"
            defaultValue={searchParams?.place ?? "all"}
            className="w-full border rounded p-2 bg-transparent"
          >
            <option value="all">Wszystkie</option>
            {/* docelowo podłącz słownik miejsc */}
            <option value="Plac A">Plac A</option>
            <option value="Plac B">Plac B</option>
            <option value="Plac C">Plac C</option>
          </select>
        </label>

        <label className="text-sm">
          <span className="block text-zinc-400 mb-1">Status</span>
          <select
            name="status"
            defaultValue={(searchParams?.status as any) ?? "all"}
            className="w-full border rounded p-2 bg-transparent"
          >
            <option value="all">Wszystkie</option>
            <option value="in-progress">w toku</option>
            <option value="pending">do zatwierdzenia</option>
            <option value="approved">zatwierdzony</option>
          </select>
        </label>

        <label className="text-sm md:col-span-2">
          <span className="block text-zinc-400 mb-1">Szukaj (ID / brygada / miejsce / zadanie)</span>
          <input
            name="q"
            placeholder="np. A / Plac A / Montaż… / 1024"
            defaultValue={searchParams?.q ?? ""}
            className="w-full border rounded p-2 bg-transparent"
          />
        </label>

        <div className="flex items-end gap-2 md:col-span-4">
          <button className="px-3 py-2 border rounded" type="submit">
            Zastosuj
          </button>
          <a href="/reports/daily" className="px-3 py-2 border rounded">
            Wyczyść
          </a>
        </div>
      </form>

      {/* TABELA */}
      <div className="border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-zinc-900">
            <tr>
              <th className="text-left p-2">ID</th>
              <th className="text-left p-2">Brygada</th>
              <th className="text-left p-2">Miejsce</th>
              <th className="text-left p-2">Zadanie</th>
              <th className="text-left p-2">Materiałów</th>
              <th className="text-left p-2">Zdjęcia</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Data</th>
              <th className="text-left p-2">Akcje</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-zinc-200/50 dark:divide-zinc-800">
            {reports.map((r) => {
              const itemsCount = (r.items ?? []).length;
              const photos =
                r.photos_count ?? (Array.isArray(r.images) ? r.images.length : 0);
              const statusText = toStatusText(r);

              return (
                <tr key={r.id}>
                  <td className="p-2">{r.id}</td>
                  <td className="p-2">{r.crew_name ?? "—"}</td>
                  <td className="p-2">{r.location ?? "—"}</td>
                  <td className="p-2">{r.task_name ?? "—"}</td>
                  <td className="p-2">{itemsCount}</td>
                  <td className="p-2">{photos}/3</td>
                  <td className="p-2">{statusText}</td>
                  <td className="p-2">{r.date}</td>
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      {!r.approved && r.is_completed && (
                        <form action={approveDailyReport}>
                          <input type="hidden" name="report_id" value={r.id} />
                          <ApproveButton>Akceptuj</ApproveButton>
                        </form>
                      )}
                      <a
                        className="px-2 py-1 border rounded"
                        href={`/reports/daily/${r.id}`}
                      >
                        Szczegóły
                      </a>
                    </div>
                  </td>
                </tr>
              );
            })}

            {reports.length === 0 && (
              <tr>
                <td className="p-3 text-center text-gray-500" colSpan={9}>
                  Brak wyników (zmień filtry).
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
