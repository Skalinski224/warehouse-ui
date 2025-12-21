// src/app/(app)/deliveries/_components/DeliveryItemsEditor.tsx
"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import RoleGuard from "@/components/RoleGuard";
import { PERM } from "@/lib/permissions";

export type DeliveryItemDraft = {
  material_id: string;
  title: string;
  qty: number;
  unit_price: number;
};

type MaterialOption = {
  id: string;
  title: string;
  unit: string | null;
};

type Props = {
  /** Aktualna lista pozycji dostawy (np. z formularza / AI). */
  items: DeliveryItemDraft[];
  /** Callback wywoływany po każdej zmianie listy. */
  onChange: (items: DeliveryItemDraft[]) => void;
  /**
   * Czy pokazywać sekcję wyszukiwarki materiałów i możliwość
   * dodawania nowych pozycji z katalogu.
   * Domyślnie true, bo w dostawach to jest sensowne.
   */
  enableSearch?: boolean;
};

function DeliveryItemsEditorInner({
  items,
  onChange,
  enableSearch = true,
}: Props) {
  const supabase = supabaseBrowser();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MaterialOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  /* ----------------------------- OPERACJE NA POZYCJACH ----------------------------- */

  function addItemFromMaterial(mat: MaterialOption) {
    const next: DeliveryItemDraft[] = [
      ...items,
      {
        material_id: mat.id,
        title: mat.title,
        qty: 1,
        unit_price: 0,
      },
    ];
    onChange(next);
  }

  function updateItemQty(index: number, raw: string) {
    const qty = Number((raw || "0").replace(",", "."));
    const next = items.map((it, i) =>
      i === index ? { ...it, qty: Number.isNaN(qty) ? 0 : qty } : it
    );
    onChange(next);
  }

  function updateItemPrice(index: number, raw: string) {
    const price = Number((raw || "0").replace(",", "."));
    const next = items.map((it, i) =>
      i === index
        ? { ...it, unit_price: Number.isNaN(price) ? 0 : price }
        : it
    );
    onChange(next);
  }

  function removeItem(index: number) {
    const next = items.filter((_, i) => i !== index);
    onChange(next);
  }

  const itemsTotal = items.reduce(
    (sum, it) => sum + (it.qty || 0) * (it.unit_price || 0),
    0
  );

  /* ----------------------------- WYSZUKIWANIE MATERIAŁÓW (LIVE) ----------------------------- */

  useEffect(() => {
    if (!enableSearch) return;

    const q = query.trim();

    // pusty input -> czyścimy wyniki i błędy
    if (!q) {
      setResults([]);
      setErrorMsg(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const handle = setTimeout(async () => {
      const { data, error } = await supabase
        .from("v_materials_overview")
        .select("id,title,unit,deleted_at")
        .ilike("title", `%${q}%`)
        .is("deleted_at", null)
        .order("title", { ascending: true })
        .limit(30);

      if (error) {
        console.warn(
          "DeliveryItemsEditor: search error",
          (error as any).message ?? error
        );
        setErrorMsg("Nie udało się pobrać materiałów. Spróbuj ponownie.");
        setResults([]);
        setLoading(false);
        return;
      }

      const mapped: MaterialOption[] = ((data ?? []) as any[]).map((m) => ({
        id: m.id as string,
        title: m.title as string,
        unit: (m.unit as string) ?? null,
      }));

      setResults(mapped);
      setLoading(false);
    }, 300); // debounce 300 ms

    return () => clearTimeout(handle);
  }, [query, enableSearch, supabase]);

  /* --------------------------------- RENDER --------------------------------- */

  return (
    <div className="space-y-3">
      {enableSearch && (
        <div className="space-y-2">
          <div className="space-y-1">
            <label className="text-xs font-medium opacity-80">
              Dodaj pozycję z katalogu materiałów
            </label>
            <input
              type="text"
              placeholder="Szukaj materiału po nazwie..."
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="text-[11px] opacity-60 h-4">
            {loading && <span>Szukam w katalogu…</span>}
            {!loading && query.trim() && results.length === 0 && !errorMsg && (
              <span>Brak wyników dla „{query.trim()}”.</span>
            )}
            {errorMsg && <span className="text-red-400">{errorMsg}</span>}
          </div>

          {results.length > 0 && (
            <div className="rounded border border-border bg-background/40 p-2 space-y-1 max-h-40 overflow-auto text-xs">
              {results.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => addItemFromMaterial(m)}
                  className="w-full text-left px-2 py-1 rounded hover:bg-card/80 flex justify-between gap-2"
                >
                  <span className="line-clamp-1">{m.title}</span>
                  {m.unit && (
                    <span className="opacity-60 font-mono text-[10px]">
                      {m.unit}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-medium opacity-80">
            Pozycje dostawy ({items.length})
          </h3>
          <span className="text-[11px] opacity-70">
            Suma pozycji:{" "}
            <strong>
              {itemsTotal.toLocaleString("pl-PL", {
                style: "currency",
                currency: "PLN",
                maximumFractionDigits: 2,
              })}
            </strong>
          </span>
        </div>

        {items.length === 0 && (
          <div className="text-xs opacity-60">
            Brak pozycji. Zacznij wpisywać nazwę materiału powyżej, żeby dodać go
            do dostawy.
          </div>
        )}

        {items.length > 0 && (
          <div className="space-y-2">
            {items.map((it, idx) => {
              const lineTotal = (it.qty || 0) * (it.unit_price || 0);

              return (
                <div
                  key={`${it.material_id}-${idx}`}
                  className="rounded border border-border bg-card px-3 py-2 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-medium">{it.title}</div>
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="text-[11px] opacity-60 hover:opacity-100"
                    >
                      Usuń
                    </button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                    <div className="space-y-1">
                      <label className="opacity-70">Ilość</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="w-full rounded border border-border bg-background px-2 py-1"
                        value={
                          Number.isFinite(it.qty as number) ? String(it.qty) : ""
                        }
                        onChange={(e) => updateItemQty(idx, e.target.value)}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="opacity-70">Cena jednostkowa</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="w-full rounded border border-border bg-background px-2 py-1"
                        value={
                          Number.isFinite(it.unit_price as number)
                            ? String(it.unit_price)
                            : ""
                        }
                        onChange={(e) => updateItemPrice(idx, e.target.value)}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="opacity-70">Razem</label>
                      <div className="w-full rounded border border-border bg-background px-2 py-1 flex items-center">
                        {lineTotal.toLocaleString("pl-PL", {
                          style: "currency",
                          currency: "PLN",
                          maximumFractionDigits: 2,
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="text-[11px] text-red-400 border border-red-500/40 rounded px-3 py-2 bg-red-500/10">
          {errorMsg}
        </div>
      )}
    </div>
  );
}

export default function DeliveryItemsEditor(props: Props) {
  // Dostęp do edycji pozycji dostawy tylko jeśli user może tworzyć/edytować niezatwierdzone dostawy.
  // (storeman/manager/owner będą mieli permy, reszta nie → komponent znika)
  return (
    <RoleGuard
      allow={[PERM.DELIVERIES_CREATE, PERM.DELIVERIES_UPDATE_UNAPPROVED]}
      silent
    >
      <DeliveryItemsEditorInner {...props} />
    </RoleGuard>
  );
}
