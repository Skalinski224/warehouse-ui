"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export type CostsBucketRow = {
  bucket: string; // ISO-ish / timestamptz string
  deliveries_cost: number | string | null;
  usage_cost: number | string | null;
};

type Props = {
  data: CostsBucketRow[];
  bucketLabel?: "Tydzień" | "Miesiąc";
};

type ChartRow = {
  bucket: string;
  label: string;
  deliveries: number;
  usage: number;
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

function fmtMoney(v: unknown) {
  const n = toNumber(v);
  return new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(n);
}

function fmtBucketLabel(raw: string) {
  const s = String(raw);
  const m = s.match(/\d{4}-\d{2}-\d{2}/);
  if (!m) return s.slice(0, 10);
  const [, mo, d] = m[0].split("-");
  return `${d}.${mo}`;
}

export default function CostsStackedBar({ data, bucketLabel = "Tydzień" }: Props) {
  const rows = useMemo<ChartRow[]>(() => {
    const arr = Array.isArray(data) ? data : [];
    return arr.map((r) => ({
      bucket: r.bucket,
      label: fmtBucketLabel(r.bucket),
      deliveries: toNumber(r.deliveries_cost),
      usage: toNumber(r.usage_cost),
    }));
  }, [data]);

  const hasData = rows.some((r) => r.deliveries > 0 || r.usage > 0);

  if (!hasData) {
    return (
      <div className="h-56 rounded-2xl border border-border bg-background/10 p-4">
        <div className="flex h-full flex-col items-center justify-center text-center">
          <div className="grid h-11 w-11 place-items-center rounded-2xl border border-border bg-background/20">
            📊
          </div>
          <p className="mt-3 text-sm font-semibold">Brak danych do wykresu</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Zmień zakres dat lub poczekaj aż pojawią się dostawy/zużycia.
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
          Dostawy vs Zużycie • {bucketLabel}
        </p>
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
      </div>

      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
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
            tickFormatter={(v: number) => fmtMoney(v)}
          />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.06)" }}
            content={<TooltipContent />}
          />

          <Bar
            dataKey="deliveries"
            stackId="cost"
            fill="rgba(255,255,255,0.28)"
            radius={[10, 10, 0, 0]}
          />
          <Bar
            dataKey="usage"
            stackId="cost"
            fill="rgba(234,179,8,0.55)"
            radius={[10, 10, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function TooltipContent(props: {
  active?: boolean;
  payload?: Array<{ payload?: Partial<ChartRow> }>;
  label?: string;
}) {
  const { active, payload, label } = props;
  if (!active || !payload?.length) return null;

  const row = payload[0]?.payload ?? {};
  const deliveries = toNumber(row.deliveries);
  const usage = toNumber(row.usage);

  return (
    <div className="rounded-2xl border border-border bg-card/90 px-3 py-2 shadow-lg backdrop-blur">
      <p className="text-xs font-semibold">Bucket: {label}</p>

      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
        <div className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-foreground/40" />
            deliveries
          </span>
          <span className="text-foreground">{fmtMoney(deliveries)}</span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-yellow-500/70" />
            usage
          </span>
          <span className="text-foreground">{fmtMoney(usage)}</span>
        </div>

        <div className="mt-2 h-px bg-border/70" />

        <div className="flex items-center justify-between gap-4">
          <span>total</span>
          <span className="text-foreground">{fmtMoney(deliveries + usage)}</span>
        </div>
      </div>
    </div>
  );
}
