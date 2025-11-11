// app/reports/deliveries/[id]/page.tsx
import { supabase } from "@/lib/supabaseClient";

type Delivery = {
  id: string;
  date: string | null;
  created_at: string | null;
  person: string | null;
  delivery_cost: number | null;
  materials_cost: number | null;
  invoice_url: string | null;
  items: { material_id?: string; quantity?: number; price?: number }[] | null;
  approved: boolean | null;
};

export default async function Page({ params }: { params: { id: string } }) {
  const { data, error } = await supabase
    .from("deliveries")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !data) {
    return <main className="p-6">Nie znaleziono dostawy.</main>;
  }

  const d = data as unknown as Delivery;
  const items = d.items ?? [];
  const itemsTotal = items.reduce((s, it) => s + ((it.quantity ?? 0) * (it.price ?? 0)), 0);
  const grand = (d.delivery_cost ?? 0) + (d.materials_cost ?? itemsTotal);

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Dostawa #{d.id.slice(0,8)}</h1>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="border rounded p-3">
          <h2 className="font-medium mb-2">Podsumowanie</h2>
          <div className="text-sm space-y-1">
            <div><span className="text-zinc-400">Data:</span> {d.date ?? d.created_at ?? "—"}</div>
            <div><span className="text-zinc-400">Osoba:</span> {d.person ?? "—"}</div>
            <div><span className="text-zinc-400">Koszt materiałów:</span> {d.materials_cost ?? itemsTotal} PLN</div>
            <div><span className="text-zinc-400">Koszt dostawy:</span> {d.delivery_cost ?? 0} PLN</div>
            <div><span className="text-zinc-400">Razem:</span> {grand} PLN</div>
            <div><span className="text-zinc-400">Status:</span> {d.approved ? "zatwierdzona" : "pending"}</div>
            <div>
              <span className="text-zinc-400">Faktura:</span>{" "}
              {d.invoice_url ? <a href={d.invoice_url} className="underline" target="_blank">otwórz</a> : "brak"}
            </div>
          </div>
        </div>

        <div className="border rounded p-3">
          <h2 className="font-medium mb-2">Pozycje ({items.length})</h2>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-zinc-900">
              <tr>
                <th className="text-left p-2">Material ID</th>
                <th className="text-right p-2">Ilość</th>
                <th className="text-right p-2">Cena</th>
                <th className="text-right p-2">Wartość</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200/50 dark:divide-zinc-800">
              {items.map((it, i) => {
                const val = (it.quantity ?? 0) * (it.price ?? 0);
                return (
                  <tr key={i}>
                    <td className="p-2">{it.material_id ?? "—"}</td>
                    <td className="p-2 text-right">{it.quantity ?? 0}</td>
                    <td className="p-2 text-right">{it.price ?? 0}</td>
                    <td className="p-2 text-right">{val}</td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr><td className="p-3 text-center text-gray-500" colSpan={4}>Brak pozycji.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
