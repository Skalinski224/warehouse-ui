// src/app/(app)/summary/_components/InventoryDeltasTable.tsx
import type React from "react";
import type { InventoryDeltaRow } from "@/lib/dto/inventoryDelta";

function money(n: number): string {
  return new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 2 }).format(n);
}
function num(n: number): string {
  return new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 3 }).format(n);
}
function showMoneyNullable(v: number | null | undefined): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  return money(v);
}
function showNumNullable(v: number | null | undefined): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  return num(v);
}

export default function InventoryDeltasTable({
  rows,
  title = "Inwentaryzacje — rozjazdy (ostatnie)",
  subtitle = "Powinno być vs policzone, wycena WAC i strata pozycji",
}: {
  rows: InventoryDeltaRow[];
  title?: string;
  subtitle?: string;
  loc?: string | null;
}) {
  let totalLoss = 0;
  for (const r of rows) {
    const v = r.loss_value;
    if (typeof v === "number" && Number.isFinite(v)) totalLoss += v;
  }

  return (
    <div className="card p-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <div className="text-xs text-muted-foreground">{subtitle}</div>
        </div>

        <div className="text-right">
          <div className="text-xs text-muted-foreground">Suma strat (wyparowało)</div>
          <div className="text-2xl font-semibold">{money(totalLoss)}</div>
        </div>
      </div>

      <div className="mt-3 text-xs text-muted-foreground">
        Pokazujemy tylko pozycje z różnicą (delta ≠ 0). Pełny audyt jest niżej na tej stronie.
      </div>

      {rows.length === 0 ? (
        <div className="mt-3 text-sm text-muted-foreground">
          Brak rozjazdów do pokazania.
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 text-left font-medium">Sesja</th>
                <th className="py-2 text-left font-medium">Materiał</th>
                <th className="py-2 text-left font-medium">Lokacja</th>
                <th className="py-2 text-right font-medium">Powinno</th>
                <th className="py-2 text-right font-medium">Policzone</th>
                <th className="py-2 text-right font-medium">Ubyło</th>
                <th className="py-2 text-right font-medium">WAC</th>
                <th className="py-2 text-right font-medium">Strata</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={`${r.session_id}:${r.material_id}:${r.inventory_location_id ?? "null"}`}
                  className="border-b border-border/60"
                >
                  <td className="py-2 font-mono text-xs">{r.session_date ?? "—"}</td>
                  <td className="py-2">
                    <div className="font-medium">{r.title}</div>
                    <div className="text-xs text-muted-foreground">{r.unit ?? "—"}</div>
                  </td>
                  <td className="py-2 font-mono text-xs">{r.inventory_location_id ?? "—"}</td>
                  <td className="py-2 text-right font-mono">{showNumNullable(r.system_qty)}</td>
                  <td className="py-2 text-right font-mono">{showNumNullable(r.counted_qty)}</td>
                  <td className="py-2 text-right font-mono">{showNumNullable(r.loss_qty)}</td>
                  <td className="py-2 text-right font-mono">{showMoneyNullable(r.wac_unit_price)}</td>
                  <td className="py-2 text-right font-mono">{showMoneyNullable(r.loss_value)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-3 text-xs text-muted-foreground">
            * „Ubyło” = <span className="font-mono text-foreground">max(0, system - counted)</span>{" "}
            · „Strata” = <span className="font-mono text-foreground">ubyło × WAC</span>
          </div>
        </div>
      )}
    </div>
  );
}
