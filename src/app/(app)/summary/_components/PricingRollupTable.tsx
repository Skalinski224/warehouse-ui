// src/app/(app)/summary/_components/PricingRollupTable.tsx
import type React from "react";
import type { MaterialPricingRollupRow } from "@/lib/dto/pvr";

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

export default function PricingRollupTable({
  rows,
  title,
}: {
  rows: MaterialPricingRollupRow[];
  title?: string;
  subtitle?: string; // legacy (ignorujemy w UI)
}) {
  const finalTitle = title ?? "Wartość inwentarza — globalnie";

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{finalTitle}</h2>
      </div>

      {rows.length === 0 ? (
        <div className="mt-3 text-sm text-muted-foreground">
          Brak danych (albo brak uprawnień do widoku).
        </div>
      ) : (
        <div className="mt-3">
          <div className="max-h-[420px] overflow-y-auto pr-1">
            <table className="w-full border-separate border-spacing-y-2 text-sm">
              <thead className="sticky top-0 z-10 bg-card text-muted-foreground">
                <tr>
                  <th className="py-2 text-left font-medium">Materiał</th>
                  <th className="py-2 text-right font-medium">Stan</th>
                  <th className="py-2 text-right font-medium">Śr. cena / j.</th>
                  <th className="py-2 text-right font-medium">Wartość (est)</th>
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
                        {showNumNullable(r.stock_qty_now)}
                      </td>

                      <td className="border-y border-border/70 bg-muted/10 py-3 text-right font-mono">
                        {showMoneyNullable(r.wac_unit_price)}
                      </td>

                      <td className="border-y border-r border-border/70 bg-muted/10 py-3 pr-3 text-right font-mono rounded-r-xl">
                        {showMoneyNullable(r.stock_value_est)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground space-y-1">
            <p>To szacunkowa wartość tego, co aktualnie znajduje się w magazynie.</p>
            <p>
              Każdy materiał wyceniany jest według średniej ceny zakupu (WAC – Weighted Average Cost),
              liczonej na podstawie Twoich wcześniejszych dostaw.
            </p>
            <p>
              Jeśli patrzysz globalnie – używany jest globalny WAC (średnia ze wszystkich lokalizacji).
              Jeśli wybierzesz konkretną lokalizację – używany jest lokalny WAC, liczony tylko z jej dostaw.
            </p>
            <p>
              Dlatego suma wartości z poszczególnych lokalizacji może różnić się od wartości globalnej –
              ponieważ średnie ceny mogą być inne w każdej lokalizacji.
            </p>
            <p>
              Dzięki temu wiesz, ile pieniędzy masz obecnie „zamrożone” w zapasie i możesz podejmować
              świadome decyzje zakupowe.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}