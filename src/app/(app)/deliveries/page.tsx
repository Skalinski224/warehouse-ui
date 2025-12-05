// src/app/(app)/deliveries/page.tsx
"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { approveDelivery } from "@/lib/actions";
import ApproveButton from "@/components/ApproveButton";
import NewDeliveryForm from "./_components/NewDeliveryForm";
import RoleGuard from "@/components/RoleGuard";

type Row = {
  id: string;
  date: string | null;
  created_at: string | null;
  place_label: string | null;
  person: string | null;
  supplier: string | null;
  delivery_cost: number | null;
  materials_cost: number | null;
  items: any[] | null;
  approved: boolean | null;
};

export default function Page() {
  const supabase = supabaseBrowser();

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

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
        "deliveries (pending) error:",
        (error as any).message ?? error
      );
      setRows([]);
    } else {
      // podwójny cast, żeby uciszyć TS (Supabase typuje data dość ogólnie)
      const safeRows = (data ?? []) as any as Row[];
      setRows(safeRows);
    }

    setLoading(false);
  }

  useEffect(() => {
    // NIE robimy async w samym callbacku useEffect
    void load();

    const ch = supabase
      .channel("deliveries-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "deliveries" },
        () => {
          void load();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="p-6 space-y-6">
      {/* HEADER */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Nowe dostawy</h1>
          <p className="text-sm opacity-70">
            Dostawy oczekujące na akceptację. Po akceptacji stany magazynowe są
            aktualizowane.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="px-3 py-2 rounded border border-border bg-card hover:bg-card/80 text-sm"
          >
            Odśwież
          </button>

          {/* + Dodaj nową dostawę → tylko manager + storeman */}
          <RoleGuard allow={["manager", "storeman"]}>
            <button
              onClick={() => setFormOpen((v) => !v)}
              className="px-3 py-2 rounded border border-border bg-foreground text-background text-sm hover:bg-foreground/90"
            >
              {formOpen ? "Zamknij formularz" : "+ Dodaj nową dostawę"}
            </button>
          </RoleGuard>
        </div>
      </header>

      {/* LISTA PENDING */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium opacity-80">
          Dostawy oczekujące na akceptację
        </h2>

        {loading && <div className="text-sm opacity-60">Ładowanie…</div>}

        {!loading && rows.length === 0 && (
          <div className="text-sm opacity-60">
            Brak dostaw do akceptacji.
          </div>
        )}

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
                  {/* GÓRA */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
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
                          })}
                        </span>
                      </div>
                      <div className="opacity-75">
                        Transport:{" "}
                        <span className="opacity-100">
                          {delivery.toLocaleString("pl-PL", {
                            style: "currency",
                            currency: "PLN",
                          })}
                        </span>
                      </div>
                      <div className="opacity-75">
                        Razem:{" "}
                        <span className="font-medium">
                          {total.toLocaleString("pl-PL", {
                            style: "currency",
                            currency: "PLN",
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* DÓŁ */}
                  <div className="pt-3 mt-2 border-t border-border/70 flex items-center justify-between gap-2">
                    <span className="text-[11px] opacity-70">
                      Akceptacja zaktualizuje stany magazynowe.
                    </span>

                    {/* Akceptuj → tylko manager + storeman */}
                    <RoleGuard allow={["manager", "storeman"]}>
                      <form action={approveDelivery} className="shrink-0">
                        <input type="hidden" name="delivery_id" value={r.id} />
                        <ApproveButton>Akceptuj</ApproveButton>
                      </form>
                    </RoleGuard>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* FORMULARZ DODANIA DOSTAWY → tylko manager + storeman */}
      <RoleGuard allow={["manager", "storeman"]}>
        <section className="pt-4 border-t border-border">
          {formOpen ? (
            <div className="mt-4 rounded-2xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-medium">Dodaj nową dostawę</h2>
                  <p className="text-xs opacity-70">
                    Wypełnij dane dostawy. Po zapisaniu pojawi się do akceptacji.
                  </p>
                </div>
              </div>

              <NewDeliveryForm />
            </div>
          ) : null}
        </section>
      </RoleGuard>
    </main>
  );
}
