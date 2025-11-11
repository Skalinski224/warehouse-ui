// src/app/deliveries/page.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { approveDelivery } from "@/lib/actions";
import ApproveButton from "@/components/ApproveButton";
import DeliveryForm from "@/components/DeliveryForm";

type Row = {
  id: string;
  date: string | null;
  created_at: string | null;
  person: string | null;
  delivery_cost: number | null;
  materials_cost: number | null;
  items: any[] | null;     // JSONB z pozycji dostawy
  approved: boolean | null;
};

export default function Page() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("deliveries")
      .select("id, date, created_at, person, delivery_cost, materials_cost, items, approved")
      .eq("approved", false)                    // tylko do akceptacji
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.warn("deliveries (pending) error:", error.message ?? error);
      setRows([]);
    } else {
      setRows((data ?? []) as Row[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();

    // Auto-refresh po UPDATE/INSERT (np. po akceptacji)
    const ch = supabase
      .channel("deliveries-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "deliveries" },
        (payload) => {
          // jeżeli coś się zmieniło w deliveries — przeładuj listę
          // (np. approved -> true, nowy rekord pending, itd.)
          load();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  return (
    <main className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Nowe dostawy (do akceptacji)</h1>
        <button onClick={load} className="px-3 py-2 border rounded">
          Odśwież
        </button>
      </header>

      {/* LISTA PENDING */}
      <div className="space-y-2">
        {loading && <div className="text-sm text-zinc-500">Ładowanie…</div>}

        {!loading && rows.length === 0 && (
          <div className="text-sm text-zinc-500">Brak dostaw do akceptacji.</div>
        )}

        {rows.map((r) => {
          const itemsCount = Array.isArray(r.items) ? r.items.length : 0;
          const total = (r.materials_cost ?? 0) + (r.delivery_cost ?? 0);

          return (
            <div key={r.id} className="flex items-center justify-between border rounded px-3 py-2">
              <div className="text-sm">
                <div className="font-mono">#{r.id.slice(0, 8)}</div>
                <div className="text-xs text-zinc-400">
                  {r.date ?? r.created_at ?? "—"} • {r.person ?? "—"}
                </div>
                <div className="text-xs">pozycji: {itemsCount}</div>
                <div className="text-xs text-zinc-400">
                  koszt:{" "}
                  {total.toLocaleString("pl-PL", {
                    style: "currency",
                    currency: "PLN",
                    maximumFractionDigits: 2,
                  })}
                </div>
              </div>

              <form action={approveDelivery}>
                <input type="hidden" name="delivery_id" value={r.id} />
                <ApproveButton>Akceptuj</ApproveButton>
              </form>
            </div>
          );
        })}
      </div>

      {/* FORMULARZ DODANIA / SZKIC */}
      <section className="pt-4 border-t">
        <DeliveryForm />
      </section>
    </main>
  );
}
