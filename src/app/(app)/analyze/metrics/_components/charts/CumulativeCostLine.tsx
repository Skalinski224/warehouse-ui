// src/app/(app)/analyze/metrics/_components/charts/CumulativeCostLine.tsx
// Client — Line chart: Narastający koszt projektu w czasie (cumulative series)

"use client";

import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export type CumulativeCostRow = {
  bucket: string;

  cumulative_total_cost?: number | string | null;

  cumulative_deliveries_cost?: number | string | null;
  cumulative_usage_cost?: number | string | null;
};

type Props = {
  data: CumulativeCostRow[];
  bucketLabel?: "Tydzień" | "Miesiąc";
};

function toNumber(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function fmtBucketLabel(raw: string) {
  const s = String(raw);
  const m = s.match(/\d{4}-\d{2}-\d{2}/);
  if (!m) return s.slice(0, 10);
  const [, mo, d] = m[0].split("-");
  return `${d}.${mo}`;
}

function fmtMoney(v: number) {
  return new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(
    Number.isFinite(v) ? v : 0
  );
}

export default function CumulativeCostLine({
  data,
  bucketLabel = "Tydzień",
}: Props) {
  const rows = useMemo(() => {
    const arr = Array.isArray(data) ? data : [];
    return arr.map((r) => {
      const total = toNumber(r.cumulative_total_cost);
      const del = toNumber(r.cumulative_deliveries_cost);
      const use = toNumber(r.cumulative_usage_cost);

      return {
        bucket: r.bucket,
        label: fmtBucketLabel(r.bucket),
        cumulative_total_cost: total,
        cumulative_deliveries_cost: del,
        cumulative_usage_cost: use,
      };
    });
  }, [data]);

  const mode = useMemo<"total" | "split">(() => {
    const anyTotal = rows.some((r) => (r.cumulative_total_cost ?? 0) > 0);
    if (anyTotal) return "total";

    const anySplit = rows.some(
      (r) =>
        (r.cumulative_deliveries_cost ?? 0) > 0 ||
        (r.cumulative_usage_cost ?? 0) > 0
    );
    return anySplit ? "split" : "total";
  }, [rows]);

  const hasData = rows.some((r) => {
    if (mode === "total") return (r.cumulative_total_cost ?? 0) > 0;
    return (
      (r.cumulative_deliveries_cost ?? 0) > 0 ||
      (r.cumulative_usage_cost ?? 0) > 0
    );
  });

  if (!hasData) {
    return (
      <div className="h-56 rounded-2xl border border-border bg-background/10 p-4">
        <div className="flex h-full flex-col items-center justify-center text-center">
          <div className="grid h-11 w-11 place-items-center rounded-2xl border border-border bg-background/20">
            📈
          </div>
          <p className="mt-3 text-sm font-semibold">Brak danych narastających</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Zmień zakres dat lub poczekaj aż pojawią się koszty.
          </p>
          <div className="mt-4 rounded-full border border-border bg-background/20 px-3 py-1 text-[11px] text-muted-foreground">
            bucket: <span className="text-foreground">{bucketLabel}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-56 rounded-2xl border border-border bg-background/10 p-3">
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <p className="text-[11px] font-semibold text-muted-foreground">
          Narastający koszt • {bucketLabel}
        </p>

        {mode === "split" ? (
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/20 px-2 py-0.5">
              <span className="h-2 w-2 rounded-full bg-foreground/40" />
              deliveries
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/20 px-2 py-0.5">
              <span className="h-2 w-2 rounded-full bg-yellow-500/70" />
              usage
            </span>
          </div>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/20 px-2 py-0.5 text-[11px] text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-foreground/25" />
            total
          </span>
        )}
      </div>

      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={rows}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "rgba(255,255,255,0.65)", fontSize: 11 }}
            axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
            tickLine={{ stroke: "rgba(255,255,255,0.12)" }}
          />
          <YAxis
            tick={{ fill: "rgba(255,255,255,0.65)", fontSize: 11 }}
            axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
            tickLine={{ stroke: "rgba(255,255,255,0.12)" }}
            tickFormatter={(v: number | string) => fmtMoney(Number(v))}
          />
          <Tooltip
            cursor={{ stroke: "rgba(255,255,255,0.12)" }}
            content={<TooltipContent mode={mode} />}
          />

          {mode === "total" ? (
            <Line
              type="monotone"
              dataKey="cumulative_total_cost"
              stroke="rgba(255,255,255,0.55)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ) : (
            <>
              <Line
                type="monotone"
                dataKey="cumulative_deliveries_cost"
                stroke="rgba(255,255,255,0.45)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="cumulative_usage_cost"
                stroke="rgba(234,179,8,0.7)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </>
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function TooltipContent({
  active,
  payload,
  label,
  mode,
}: {
  active?: boolean;
  payload?: Array<{ payload: any }>;
  label?: string;
  mode: "total" | "split";
}) {
  if (!active || !payload?.length) return null;

  const row = payload[0]?.payload ?? {};

  return (
    <div className="rounded-2xl border border-border bg-card/90 px-3 py-2 shadow-lg backdrop-blur">
      <p className="text-xs font-semibold">Bucket: {label}</p>

      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
        {mode === "total" ? (
          <div className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-foreground/25" />
              total
            </span>
            <span className="text-foreground">
              {fmtMoney(toNumber(row.cumulative_total_cost))}
            </span>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-foreground/40" />
                deliveries
              </span>
              <span className="text-foreground">
                {fmtMoney(toNumber(row.cumulative_deliveries_cost))}
              </span>
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-yellow-500/70" />
                usage
              </span>
              <span className="text-foreground">
                {fmtMoney(toNumber(row.cumulative_usage_cost))}
              </span>
            </div>

            <div className="mt-2 h-px bg-border/70" />

            <div className="flex items-center justify-between gap-4">
              <span>total</span>
              <span className="text-foreground">
                {fmtMoney(
                  toNumber(row.cumulative_deliveries_cost) +
                    toNumber(row.cumulative_usage_cost)
                )}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
