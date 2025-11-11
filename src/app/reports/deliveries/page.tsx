// app/reports/deliveries/page.tsx
// Server Component

import { supabase } from "@/lib/supabaseClient";
import { approveDelivery } from "@/lib/actions";
import ApproveButton from "@/components/ApproveButton";

type Row = {
  id: string;
  date: string | null;
  created_at: string | null;
  person: string | null;
  delivery_cost: number | null;
  materials_cost: number | null;
  items: any[] | null;      // jsonb z pozycjami
  approved: boolean | null;
};

function isLikelyId(s: string) {
  // prosta detekcja UUID albo co najmniej 8 znaków hex/alfanumerycznych z myślnikami
  return /^[0-9a-f-]{8,}$/i.test(s);
}

async function fetchRows(params: {
  from?: string;
  to?: string;
  person?: string;
  status?: "all" | "pending" | "approved";
  q?: string;
}): Promise<Row[]> {
  let q = supabase
    .from("deliveries")
    .select(
      "id, date, created_at, person, delivery_cost, materials_cost, items, approved"
    )
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
    q = isLikelyId(s) ? q.eq("id", s) : q.ilike("person", `%${s}%`);
  }

  const { data, error } = await q;
  if (error) {
    console.warn("reports/deliveries error:", error.message ?? error);
    return [];
  }
  return (data ?? []) as Row[];
}

export default async function Page({
  searchParams,
}: {
  searchParams?: {
    from?: string;
    to?: string;
    person?: string;
    status?: "all" | "pending" | "approved";
    q?: string;
  };
}) {
  const params = {
    from: searchParams?.from,
    to: searchParams?.to,
    person: searchParams?.person,
    status: (searchParams?.status as "all" | "pending" | "approved") ?? "all",
    q: searchParams?.q,
  };

  const rows = await fetchRows(params);

  const fmt = new Intl.NumberFormat("pl-PL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Nowe dostawy (raport)</h1>

      {/* FILTRY (GET) */}
      <form className="border rounded p-3 grid gap-3 md:grid-cols-6" method="get">
        <label className="text-sm">
          <span className="block text-zinc-400 mb-1">Od</span>
          <input
            type="date"
            name="from"
            defaultValue={params.from ?? ""}
            className="w-full border rounded p-2 bg-transparent"
          />
        </label>

        <label className="text-sm">
          <span className="block text-zinc-400 mb-1">Do</span>
          <input
            type="date"
            name="to"
            defaultValue={params.to ?? ""}
            className="w-full border rounded p-2 bg-transparent"
          />
        </label>

        <label className="text-sm">
          <span className="block text-zinc-400 mb-1">Osoba</span>
          <input
            name="person"
            placeholder="np. Magazynier A"
            defaultValue={params.person ?? ""}
            className="w-full border rounded p-2 bg-transparent"
          />
        </label>

        <label className="text-sm">
          <span className="block text-zinc-400 mb-1">Status</span>
          <select
            name="status"
            defaultValue={params.status}
            className="w-full border rounded p-2 bg-transparent"
          >
            <option value="all">Wszystkie</option>
            <option value="pending">W toku</option>
            <option value="approved">Zatwierdzone</option>
          </select>
        </label>

        <label className="text-sm md:col-span-2">
          <span className="block text-zinc-400 mb-1">Szukaj (ID / osoba)</span>
          <input
            name="q"
            placeholder="np. #id lub nazwisko"
            defaultValue={params.q ?? ""}
            className="w-full border rounded p-2 bg-transparent"
          />
        </label>

        <div className="flex items-end gap-2 md:col-span-6">
          <button className="px-3 py-2 border rounded" type="submit">
            Zastosuj
          </button>
          <a href="/reports/deliveries" className="px-3 py-2 border rounded">
            Wyczyść
          </a>
        </div>
      </form>

      {/* LISTA */}
      <div className="space-y-2">
        {rows.map((r) => {
          const itemsCount = (r.items ?? []).length;
          const total = (r.materials_cost ?? 0) + (r.delivery_cost ?? 0);

          return (
            <div
              key={r.id}
              className="flex items-center justify-between border rounded px-3 py-2"
            >
              <div className="text-sm">
                <a
                  href={`/reports/deliveries/${r.id}`}
                  className="font-mono underline"
                >
                  #{r.id.slice(0, 8)}
                </a>
                <div className="text-xs text-zinc-400">
                  {r.date ?? r.created_at ?? "—"} • {r.person ?? "—"}
                </div>
                <div className="text-xs">pozycji: {itemsCount}</div>
                <div className="text-xs text-zinc-400">
                  koszt: {fmt.format(total)} PLN
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs">
                  {r.approved ? "zatwierdzona" : "pending"}
                </span>

                {!r.approved && (
                  <form action={approveDelivery}>
                    <input type="hidden" name="delivery_id" value={r.id} />
                    {/* Jeśli nie masz własnego przycisku, możesz użyć zwykłego <button> */}
                    <ApproveButton>Akceptuj</ApproveButton>
                  </form>
                )}

                <a
                  className="px-2 py-1 border rounded"
                  href={`/reports/deliveries/${r.id}`}
                >
                  Szczegóły
                </a>
              </div>
            </div>
          );
        })}

        {rows.length === 0 && (
          <div className="text-sm text-zinc-500">Brak wyników (zmień filtry).</div>
        )}
      </div>
    </main>
  );
}
