// src/app/(app)/analyze/metrics/_components/TopUsageTable.tsx
// Client — TOP 5 zużyć (klik -> /materials/[id])

"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { TopUsageItem } from "@/lib/dto/metrics";

type Props = {
  data: TopUsageItem[];
};

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

function fmtMoney(v?: number) {
  if (v === null || v === undefined) return "—";
  const n = Number.isFinite(v) ? v : 0;
  return new Intl.NumberFormat("pl-PL", {
    style: "decimal",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtQty(v: number) {
  const n = Number.isFinite(v) ? v : 0;
  return new Intl.NumberFormat("pl-PL", {
    style: "decimal",
    maximumFractionDigits: 2,
  }).format(n);
}

export default function TopUsageTable({ data }: Props) {
  const rows = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  return (
    <div className="card p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground">
            TOP 5 ZUŻYĆ
          </p>
          <h3 className="mt-1 text-base font-semibold">Co zjada projekt</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Kliknij w materiał, żeby przejść do szczegółów i historii.
          </p>
        </div>

        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/20 px-3 py-1 text-[11px] text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-foreground/25" />
          drill-down enabled
        </span>
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-background/10">
        {/* Header */}
        <div className="grid grid-cols-[1fr_120px_140px] gap-2 border-b border-border bg-background/10 px-3 py-2 text-[11px] font-semibold text-muted-foreground">
          <div>Nazwa</div>
          <div className="text-right">Qty</div>
          <div className="text-right">Est. koszt</div>
        </div>

        {/* Body */}
        <div className="divide-y divide-border">
          {rows.length === 0 ? (
            <div className="px-3 py-10 text-center">
              <div className="mx-auto grid h-10 w-10 place-items-center rounded-2xl border border-border bg-background/20">
                💤
              </div>
              <p className="mt-3 text-sm font-semibold">Brak danych</p>
              <p className="mt-1 text-xs text-muted-foreground">
                W tym zakresie nie znaleziono zużyć materiałów.
              </p>
            </div>
          ) : (
            rows.map((r, idx) => {
              const href = `/materials/${r.material_id}`;

              return (
                <Link
                  key={r.material_id}
                  href={href}
                  className={cx(
                    "group block px-3 py-2 transition",
                    "hover:bg-card/40"
                  )}
                  title="Otwórz materiał"
                >
                  <div className="grid grid-cols-[1fr_120px_140px] items-center gap-2">
                    {/* Name */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={cx(
                            "inline-flex h-6 w-6 items-center justify-center rounded-xl border border-border",
                            "bg-background/20 text-[11px] text-muted-foreground"
                          )}
                        >
                          #{idx + 1}
                        </span>

                        <p className="truncate text-sm font-medium">
                          {r.name || "—"}
                        </p>

                        <span className="ml-auto hidden items-center gap-2 text-[10px] text-muted-foreground group-hover:inline-flex">
                          open → <span className="h-1.5 w-1.5 rounded-full bg-foreground/30" />
                        </span>
                      </div>

                      <p className="mt-1 truncate text-[11px] text-muted-foreground">
                        ID: {r.material_id}
                      </p>
                    </div>

                    {/* Qty */}
                    <div className="text-right">
                      <p className="text-sm font-semibold">
                        {fmtQty(r.qty_used)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        suma qty_used
                      </p>
                    </div>

                    {/* Cost */}
                    <div className="text-right">
                      <p className="text-sm font-semibold">{fmtMoney(r.est_cost)}</p>
                      <p className="text-[11px] text-muted-foreground">
                        est. (last price)
                      </p>
                    </div>
                  </div>

                  {/* “Kosmiczny” sygnał: linia mocy */}
                  <div className="mt-2 h-[2px] w-full overflow-hidden rounded-full bg-border">
                    <div
                      className={cx(
                        "h-full rounded-full bg-foreground/15 transition-all",
                        idx === 0
                          ? "w-3/4 group-hover:w-[85%]"
                          : idx === 1
                          ? "w-2/3 group-hover:w-3/4"
                          : idx === 2
                          ? "w-1/2 group-hover:w-2/3"
                          : idx === 3
                          ? "w-1/3 group-hover:w-1/2"
                          : "w-1/4 group-hover:w-1/3"
                      )}
                    />
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-border bg-background/10 p-3">
        <p className="text-[11px] text-muted-foreground">
          Uwaga: <span className="text-foreground">est. koszt</span> to
          przybliżenie (qty_used × ostatnia cena). To jest panel operacyjny, nie
          księgowość.
        </p>
      </div>
    </div>
  );
}
