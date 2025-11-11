// app/reports/daily/[id]/page.tsx
import { supabase } from "@/lib/supabaseClient";

export default async function Page({ params }: { params: { id: string } }) {
  const { data, error } = await supabase
    .from("daily_reports")
    .select(`
      id, crew, place_id, status, date, task_name, photos_count,
      daily_report_items ( material_name, quantity_used ),
      items ( material_name, quantity_used )
    `)
    .eq("id", params.id)
    .single();

  if (error || !data) {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-semibold">Raport dzienny</h1>
        <p className="text-sm text-red-400 mt-2">Nie znaleziono raportu.</p>
      </main>
    );
  }

  const mats = (data.daily_report_items ?? data.items ?? []) as {
    material_name?: string | null;
    quantity_used?: number | null;
  }[];

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Raport dzienny #{data.id}</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border rounded p-3">
          <div><span className="text-gray-500">Brygada:</span> {data.crew ?? "—"}</div>
          <div><span className="text-gray-500">Miejsce:</span> {data.place_id ?? "—"}</div>
          <div><span className="text-gray-500">Data:</span> {data.date}</div>
          <div><span className="text-gray-500">Zadanie:</span> {data.task_name ?? "—"}</div>
          <div><span className="text-gray-500">Zdjęcia:</span> {data.photos_count ?? 0} / 3</div>
          <div><span className="text-gray-500">Status:</span> {data.status}</div>
        </div>

        <div className="border rounded p-3">
          <div className="font-medium mb-2">Materiały</div>
          {mats.length === 0 ? (
            <div className="text-sm text-gray-500">Brak pozycji.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left p-2">Materiał</th>
                  <th className="text-left p-2">Ilość</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200/50 dark:divide-zinc-800">
                {mats.map((m, i) => (
                  <tr key={i}>
                    <td className="p-2">{m.material_name ?? "—"}</td>
                    <td className="p-2">{m.quantity_used ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
}
