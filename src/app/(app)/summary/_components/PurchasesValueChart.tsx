// src/app/(app)/summary/_components/PurchasesValueChart.tsx
"use client";

import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
  Bar,
  Line,
  ComposedChart,
} from "recharts";

type Point = {
  bucket: string;
  purchases_value: number | null;
};

type Mode = "bar" | "line" | "both";

function moneyPL(n: number): string {
  return new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 2 }).format(n);
}

function safeNum(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

// bucket masz jako string (np. "2026-02-17" albo start tygodnia). Sort leksykalny dla ISO działa OK.
function sortByBucketAsc(a: { bucket: string }, b: { bucket: string }) {
  return String(a.bucket).localeCompare(String(b.bucket));
}

export default function PurchasesValueChart({
  points,
  title = "Zakupy materiałów — trend",
  subtitle = "Źródło: pvr_summary_overview.time_series_weekly.purchases_value",
  height = 260,
}: {
  points: Point[];
  title?: string;
  subtitle?: string;
  height?: number;
}) {
  const [mode, setMode] = useState<Mode>("both");

  const data = useMemo(() => {
    const arr = Array.isArray(points) ? points : [];
    const norm = arr
      .map((p) => ({
        bucket: String(p?.bucket ?? ""),
        purchases_value: safeNum(p?.purchases_value),
      }))
      .filter((x) => x.bucket);

    norm.sort(sortByBucketAsc);
    return norm;
  }, [points]);

  const total = useMemo(() => {
    let s = 0;
    for (const r of data) s += safeNum(r.purchases_value);
    return s;
  }, [data]);

  return (
    <div className="card p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <div className="mt-0.5 text-xs text-muted-foreground">{subtitle}</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-2 text-right">
            <div className="text-xs text-muted-foreground">Suma w zakresie</div>
            <div className="text-xl font-semibold">{moneyPL(total)}</div>
          </div>

          <button
            type="button"
            className={`rounded-xl border border-border px-3 py-2 text-sm hover:bg-muted ${
              mode === "bar" ? "bg-muted/40" : "bg-card"
            }`}
            onClick={() => setMode("bar")}
          >
            Słupki
          </button>
          <button
            type="button"
            className={`rounded-xl border border-border px-3 py-2 text-sm hover:bg-muted ${
              mode === "line" ? "bg-muted/40" : "bg-card"
            }`}
            onClick={() => setMode("line")}
          >
            Linia
          </button>
          <button
            type="button"
            className={`rounded-xl border border-border px-3 py-2 text-sm hover:bg-muted ${
              mode === "both" ? "bg-muted/40" : "bg-card"
            }`}
            onClick={() => setMode("both")}
          >
            Oba
          </button>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="mt-3 text-sm text-muted-foreground">
          Brak punktów czasu dla tego zakresu (albo DB nie zwróciło purchases_value).
        </div>
      ) : (
        <div className="mt-3" style={{ width: "100%", height }}>
          <ResponsiveContainer>
            <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="bucket"
                tickMargin={8}
                minTickGap={24}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                tickMargin={8}
                tick={{ fontSize: 12 }}
                tickFormatter={(v) => moneyPL(Number(v))}
              />
              <Tooltip
                formatter={(value: any) => moneyPL(Number(value))}
                labelFormatter={(label: any) => `Okres: ${String(label)}`}
              />

              {(mode === "bar" || mode === "both") ? (
                <Bar dataKey="purchases_value" />
              ) : null}

              {(mode === "line" || mode === "both") ? (
                <Line
                  type="monotone"
                  dataKey="purchases_value"
                  dot={false}
                  strokeWidth={2}
                />
              ) : null}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
