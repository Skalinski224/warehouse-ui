// src/components/daily-reports/MaterialsUsageTable.tsx
"use client";

import { useMemo, useState, ChangeEvent, useEffect } from "react";
import type { MaterialOption } from "@/lib/dto";

export type MaterialUsageRow = {
  materialId: string;
  qtyUsed: number;
};

type Props = {
  materials: MaterialOption[];
  /** Stan pozycji trzymany w DailyReportForm (formState.items) */
  value: MaterialUsageRow[];
  /** Aktualizacja pozycji w DailyReportForm */
  onChange: (rows: MaterialUsageRow[]) => void;
  /**
   * Callback do sygnalizacji, że jest błąd walidacji
   * (np. ilość > stan magazynowy) – możesz na tej podstawie
   * blokować przejście do podsumowania.
   */
  onValidationChange?: (hasError: boolean) => void;
};

export default function MaterialsUsageTable({
  materials,
  value,
  onChange,
  onValidationChange,
}: Props) {
  const [search, setSearch] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const maxRows = 200; // twardy limit, żeby nikt nie zabił UI

  const filteredMaterials = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return materials.slice(0, 20);
    return materials
      .filter((m) => m.title.toLowerCase().includes(q))
      .slice(0, 20);
  }, [materials, search]);

  const hasError = Object.keys(errors).length > 0;

  // NIE wywołuj callbacka w renderze (React warning / loop). Zrób to w effect.
  useEffect(() => {
    if (onValidationChange) onValidationChange(hasError);
  }, [hasError, onValidationChange]);

  function addMaterial(materialId: string) {
    if (!materialId) return;
    if (value.length >= maxRows) return;

    const material = materials.find((m) => m.id === materialId);
    if (!material) return;

    const existing = value.find((r) => r.materialId === materialId);
    if (existing) {
      const next = value.map((r) =>
        r.materialId === materialId
          ? { ...r, qtyUsed: r.qtyUsed + 1 }
          : r
      );
      onChange(next);
      validateRow(materialId, existing.qtyUsed + 1);
      return;
    }

    const next = [...value, { materialId, qtyUsed: 1 }];
    onChange(next);
    validateRow(materialId, 1);
    setSearch("");
  }

  function handleQtyChange(materialId: string, e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const qty = raw === "" ? 0 : Number(raw.replace(",", "."));

    if (Number.isNaN(qty) || qty < 0) return;

    const next = value.map((r) =>
      r.materialId === materialId ? { ...r, qtyUsed: qty } : r
    );
    onChange(next);
    validateRow(materialId, qty);
  }

  function validateRow(materialId: string, qty: number) {
    const material = materials.find((m) => m.id === materialId);
    if (!material) return;

    const max = material.currentQuantity ?? 0;
    let msg = "";

    if (qty <= 0) {
      msg = "Ilość musi być większa od zera.";
    } else if (qty > max) {
      msg = `Nie możesz zużyć więcej niż aktualny stan (${max}).`;
    }

    setErrors((prev) => {
      const clone = { ...prev };
      if (msg) {
        clone[materialId] = msg;
      } else {
        delete clone[materialId];
      }
      return clone;
    });
  }

  function removeRow(materialId: string) {
    const next = value.filter((r) => r.materialId !== materialId);
    onChange(next);
    setErrors((prev) => {
      const clone = { ...prev };
      delete clone[materialId];
      return clone;
    });
  }

  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Zużyte materiały</h2>
          <p className="text-xs text-muted-foreground">
            Wybierz pozycje z magazynu i wpisz ilość faktycznie zużytą dzisiaj.
          </p>
        </div>
      </div>

      {/* Wyszukiwarka / wybór materiału */}
      <div className="space-y-2">
        <div className="relative">
          <input
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="Szukaj materiału…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-card text-xs">
              {filteredMaterials.length === 0 ? (
                <div className="px-3 py-2 text-muted-foreground">
                  Brak wyników.
                </div>
              ) : (
                filteredMaterials.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => addMaterial(m.id)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-background/70"
                  >
                    <span>
                      {m.title}
                      {m.unit && (
                        <span className="text-muted-foreground">
                          {" "}
                          ({m.unit})
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      stan: {m.currentQuantity}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tabela pozycji */}
      {value.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Materiał</th>
                <th className="px-3 py-2 text-left">Ilość</th>
                <th className="px-3 py-2 text-right">Akcje</th>
              </tr>
            </thead>
            <tbody>
              {value.map((row) => {
                const material = materials.find(
                  (m) => m.id === row.materialId
                );

                const errorMsg = errors[row.materialId];

                return (
                  <tr
                    key={row.materialId}
                    className="border-t border-border/60 align-top"
                  >
                    <td className="px-3 py-2">
                      <div className="text-sm">
                        {material?.title ?? "Nieznany materiał"}
                      </div>
                      {material?.unit && (
                        <div className="text-xs text-muted-foreground">
                          jednostka: {material.unit}
                        </div>
                      )}
                      {material && (
                        <div className="text-[11px] text-muted-foreground">
                          stan: {material.currentQuantity}
                        </div>
                      )}
                      {errorMsg && (
                        <div className="mt-1 text-[11px] text-red-500">
                          {errorMsg}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        step={0.1}
                        className="w-24 rounded-lg border border-border bg-background px-2 py-1 text-sm"
                        value={row.qtyUsed}
                        onChange={(e) => handleQtyChange(row.materialId, e)}
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => removeRow(row.materialId)}
                        className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-background/80"
                      >
                        Usuń pozycję
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {value.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Na razie brak pozycji. Wyszukaj materiał powyżej, aby dodać pierwszą
          linię.
        </p>
      )}
    </div>
  );
}
