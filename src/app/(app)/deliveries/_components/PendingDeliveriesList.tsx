// src/app/(app)/deliveries/_components/PendingDeliveriesList.tsx
"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { approveDelivery } from "@/lib/actions";
import ApproveButton from "@/components/ApproveButton";

export type PendingDeliveryRow = {
  id: string;
  date: string | null;
  created_at: string | null;
  place_label: string | null;
  person: string | null;
  supplier: string | null;
  delivery_cost: number | null;
  materials_cost: number | null;
  items: any[] | null; // JSONB z pozycjami dostawy
  approved: boolean | null;
};

type Props = {
  /** Czy wyświetlić nagłówek sekcji. Domyślnie true. */
  showHeader?: boolean;
};

export default function PendingDeliveriesList({ showHeader = true }: Props) {
  const supabase = supabaseBrowser();

  const [rows, setRows] = useState<PendingDeliveryRow[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);

    const { data, error } = await supabase
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
        ].join(", ")
      )
      .eq("approved", false)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.warn(
        "PendingDeliveriesList: deliveries (pending) error:",
        (error as any).message ?? error
      );
      setRows([]);
    } else {
      const safeRows = (data ?? []) as unknown as PendingDeliveryRow[];
      setRows(safeRows);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();

    const ch = supabase
      .channel("deliveries-pending-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "deliveries" },
        () => {
          load();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="space-y-3">
      {showHeader && (
        <h2 className="text-sm font-medium opacity-80">
          Dostawy oczekujące na akceptację
        </h2>
      )}

      <div className="flex items-center justify-between text-xs">
        {loading && (
          <span className="opacity-60">Ładowanie dostaw oczekujących…</span>
        )}
        {!loading && rows.length === 0 && (
          <span className="opacity-60">
            Brak dostaw do akceptacji. Dodaj nową dostawę lub poczekaj na
            zgłoszenia z budowy.
          </span>
        )}
        {!loading && rows.length > 0 && (
          <span className="opacity-60">
            Łącznie: <strong>{rows.length}</strong>
          </span>
        )}
      </div>

      {!loading && rows.length > 0 && (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => {
            const itemsCount = Array.isArray(r.items) ? r.items.length : 0;
            const materials = r.materials_cost ?? 0;
            const delivery = r.delivery_cost ?? 0;
            const total = materials + delivery;

            const dateLabel =
              r.date ??
              (r.created_at
                ? new Date(r.created_at).toLocaleDateString("pl-PL")
                : "—");

            const placeLabel = r.place_label || "brak miejsca";
            const personLabel = r.person || "nie podano osoby";
            const supplierLabel = r.supplier || "";

            return (
              <li
                key={r.id}
                className="rounded border border-border bg-card p-4 flex flex-col justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-mono text-xs opacity-80">
                      #{r.id.slice(0, 8)}
                    </div>
                    <span className="text-[11px] px-2 py-1 rounded bg-background/70 border border-border/80">
                      {itemsCount} poz.
                    </span>
                  </div>

                  <div className="text-xs opacity-70">
                    {dateLabel} • {placeLabel}
                  </div>

                  <div className="text-xs opacity-70">
                    {personLabel}
                    {supplierLabel && ` • ${supplierLabel}`}
                  </div>

                  <div className="mt-2 space-y-0.5 text-xs">
                    <div className="opacity-75">
                      Materiały:{" "}
                      <span className="opacity-100">
                        {materials.toLocaleString("pl-PL", {
                          style: "currency",
                          currency: "PLN",
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <div className="opacity-75">
                      Transport / dostawa:{" "}
                      <span className="opacity-100">
                        {delivery.toLocaleString("pl-PL", {
                          style: "currency",
                          currency: "PLN",
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <div className="opacity-75">
                      Razem:{" "}
                      <span className="font-medium">
                        {total.toLocaleString("pl-PL", {
                          style: "currency",
                          currency: "PLN",
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 mt-2 border-t border-border/70 flex items-center justify-between gap-2">
                  <span className="text-[11px] opacity-70">
                    Po akceptacji stany magazynowe zostaną uzupełnione na
                    podstawie pozycji dostawy.
                  </span>
                  <form action={approveDelivery} className="shrink-0">
                    <input type="hidden" name="delivery_id" value={r.id} />
                    <ApproveButton>Akceptuj</ApproveButton>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
