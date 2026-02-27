// src/app/(app)/summary/_components/DeliveriesRangeTable.tsx
"use client";

import type React from "react";
import { useRouter } from "next/navigation";
import type { DeliveryRangeRow } from "@/lib/dto/pvr";

function moneyPL(v: number | null | undefined): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  return new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 2 }).format(v);
}

export default function DeliveriesRangeTable({
  rows,
  from,
  to,
}: {
  rows: DeliveryRangeRow[];
  from: string;
  to: string;
}) {
  const router = useRouter();

  const totalDeliveryCost = rows.reduce((acc, r) => acc + (r.delivery_cost ?? 0), 0);
  const totalMaterialsCost = rows.reduce((acc, r) => acc + (r.materials_cost ?? 0), 0);

  return (
    <div className="card p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <h2 className="text-base font-semibold">Dostawy</h2>

        <div className="text-xs text-muted-foreground">
          Logistyka:{" "}
          <span className="font-semibold text-foreground">
            {moneyPL(totalDeliveryCost)}
          </span>
          <span className="mx-2">•</span>
          Materiały:{" "}
          <span className="font-semibold text-foreground">
            {moneyPL(totalMaterialsCost)}
          </span>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="mt-3 text-sm text-muted-foreground">
          Brak dostaw w tym zakresie.
        </div>
      ) : (
        <div className="mt-3">
          <div className="max-h-[420px] overflow-y-auto pr-1">
            <table className="w-full border-separate border-spacing-y-2 text-sm">
              <thead className="sticky top-0 z-10 bg-card text-muted-foreground">
                <tr>
                  <th className="py-2 text-left font-medium">Data</th>
                  <th className="py-2 text-left font-medium">Lokalizacja</th>
                  <th className="py-2 text-left font-medium">Dostawca</th>
                  <th className="py-2 text-left font-medium">Zatwierdził</th>
                  <th className="py-2 text-right font-medium">Logistyka</th>
                  <th className="py-2 text-right font-medium">Materiały</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((r) => {
                  const loc = r.place_label || r.inventory_location_id;
                  const approvedName = r.approved_by_name ?? "—";

                  const href = `/reports/deliveries/${r.delivery_id}`;

                  return (
                    <tr
                      key={r.delivery_id}
                      className="align-middle cursor-pointer hover:opacity-90 transition"
                      role="button"
                      tabIndex={0}
                      onClick={() => router.push(href)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") router.push(href);
                      }}
                    >
                      <td className="border-y border-l border-border/70 bg-muted/10 py-3 pl-3 pr-3 rounded-l-xl font-mono">
                        {r.delivery_date ?? "—"}
                      </td>

                      <td className="border-y border-border/70 bg-muted/10 py-3 pr-3">
                        {loc ? (
                          <span className={r.place_label ? "" : "font-mono"}>
                            {loc}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>

                      <td className="border-y border-border/70 bg-muted/10 py-3 pr-3">
                        {r.supplier ?? "—"}
                      </td>

                      <td className="border-y border-border/70 bg-muted/10 py-3 pr-3 text-xs text-muted-foreground">
                        {approvedName}
                      </td>

                      <td className="border-y border-border/70 bg-muted/10 py-3 pr-3 text-right font-mono">
                        {moneyPL(r.delivery_cost)}
                      </td>

                      <td className="border-y border-r border-border/70 bg-muted/10 py-3 pr-3 text-right font-mono rounded-r-xl">
                        {moneyPL(r.materials_cost)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              <tfoot>
                <tr className="border-t border-border">
                  <td
                    className="py-2 text-left text-xs text-muted-foreground"
                    colSpan={4}
                  >
                    Razem ({rows.length})
                  </td>
                  <td className="py-2 text-right font-semibold">
                    {moneyPL(totalDeliveryCost)}
                  </td>
                  <td className="py-2 text-right font-semibold">
                    {moneyPL(totalMaterialsCost)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* STOPKA OPISOWA */}
          <div className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground space-y-1">
            <p>
              To suma kosztów transportu wpisanych w zatwierdzonych dostawach z wybranego zakresu dat.
              Wartość materiału liczona jest osobno.
            </p>
            <p>
              Dane liczone są osobno dla każdej lokalizacji lub łącznie dla całej firmy.
            </p>
            <p>
              Pozwala to kontrolować, ile realnie kosztuje dowożenie materiału
              i czy sposób zamawiania jest efektywny.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}