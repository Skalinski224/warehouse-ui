// src/app/(app)/summary/_components/PricingRollupSpendRangeTable.tsx
"use client";

import type React from "react";
import type { MaterialPricingRollupSpendRow } from "@/lib/dto/pvr";

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

export default function PricingRollupSpendRangeTable({
  rows,
  title = "Wydatki na materiały",
}: {
  rows: MaterialPricingRollupSpendRow[];
  from: string; // zostawiamy w props (nie używamy w UI)
  to: string; // zostawiamy w props (nie używamy w UI)
  title?: string;
  subtitle?: string; // legacy (nie używamy w UI)
}) {
  let total = 0;
  for (const r of rows) {
    const v = r.spent_value_in_range;
    if (typeof v === "number" && Number.isFinite(v)) total += v;
  }

  return (
    <div className="card p-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
        </div>

        <div className="text-right">
          <div className="text-xs text-muted-foreground">Suma wydatków</div>
          <div className="text-2xl font-semibold">{money(total)}</div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="mt-3 text-sm text-muted-foreground">
          Brak zakupów w tym zakresie (albo brak uprawnień do RPC).
        </div>
      ) : (
        <div className="mt-3">
          <div className="max-h-[420px] overflow-y-auto pr-1">
            <table className="w-full border-separate border-spacing-y-2 text-sm">
              <thead className="sticky top-0 z-10 bg-card text-muted-foreground">
                <tr>
                  <th className="py-2 text-left font-medium">Materiał</th>
                  <th className="py-2 text-right font-medium">Ilość</th>
                  <th className="py-2 text-right font-medium">Dostaw</th>
                  <th className="py-2 text-right font-medium">WAC (as-of)</th>
                  <th className="py-2 text-right font-medium">Wydaliśmy</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((r) => {
                  const label =
                    r.rollup_label ??
                    (r as any).rollupLabel ??
                    (r as any).rollup_label ??
                    null;

                  const name =
                    typeof label === "string" && label.trim() !== ""
                      ? label
                      : r.rollup_key;

                  return (
                    <tr key={r.rollup_key} className="align-middle">
                      <td className="border-y border-l border-border/70 bg-muted/10 py-3 pl-3 pr-3 rounded-l-xl">
                        <div className="font-medium leading-5">{name}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {r.unit ?? "—"}
                        </div>
                      </td>

                      <td className="border-y border-border/70 bg-muted/10 py-3 text-right font-mono">
                        {showNumNullable(r.spent_qty_in_range)}
                      </td>

                      <td className="border-y border-border/70 bg-muted/10 py-3 text-right font-mono">
                        {showNumNullable(r.deliveries_count_in_range)}
                      </td>

                      <td className="border-y border-border/70 bg-muted/10 py-3 text-right font-mono">
                        {showMoneyNullable(r.wac_unit_price_asof_to)}
                      </td>

                      <td className="border-y border-r border-border/70 bg-muted/10 py-3 pr-3 text-right font-mono rounded-r-xl">
                        {showMoneyNullable(r.spent_value_in_range)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
            WAC (as-of) = średnia cena zakupu ważona ilością (Weighted Average Cost),
            policzona na podstawie zatwierdzonych dostaw do końca wybranego okresu
            (as-of “to”). Następnie ta cena jest używana do wyceny stanu i porównań.
          </div>
        </div>
      )}
    </div>
  );
}