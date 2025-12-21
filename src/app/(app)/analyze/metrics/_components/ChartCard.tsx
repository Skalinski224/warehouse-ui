// src/app/(app)/analyze/metrics/_components/ChartCard.tsx
// Client — karta wykresu (na razie placeholder + skeleton)
// Cel: “NASA vibe” bez przeładowania — tytuł, opis, ramka pod chart, stan ładowania.

"use client";

import { useMemo } from "react";

type Props = {
  title: string;
  subtitle?: string | null;

  // placeholder pod przyszłość (np. "stacked-bar", "line", itp.)
  kind?: "placeholder" | "stacked" | "line" | "bar";

  // jeżeli kiedyś podasz data, możesz sterować czy pokazać skeleton czy pustkę
  loading?: boolean;
  emptyHint?: string | null;

  // children pozwala w przyszłości wsadzić realny wykres bez zmiany API komponentu
  children?: React.ReactNode;
};

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

export default function ChartCard({
  title,
  subtitle,
  kind = "placeholder",
  loading = false,
  emptyHint,
  children,
}: Props) {
  const chip = useMemo(() => {
    if (kind === "stacked") return "STACKED";
    if (kind === "line") return "LINE";
    if (kind === "bar") return "BAR";
    return "CHART";
  }, [kind]);

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-muted-foreground">
            WYKRES
          </p>
          <h3 className="mt-1 truncate text-sm font-semibold">{title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {subtitle ?? "Wykres podpięty w następnym kroku."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-border bg-background/20 px-2 py-1 text-[10px] text-muted-foreground">
            {chip}
          </span>
          <span
            className={cx(
              "inline-flex items-center gap-2 rounded-full border border-border bg-background/20 px-2 py-1 text-[10px]",
              loading ? "text-yellow-300" : "text-muted-foreground"
            )}
            title={loading ? "Ładowanie danych wykresu" : "Placeholder"}
          >
            <span
              className={cx(
                "h-2 w-2 rounded-full",
                loading ? "bg-yellow-500/75" : "bg-foreground/25"
              )}
            />
            {loading ? "loading" : "armed"}
          </span>
        </div>
      </div>

      {/* Chart frame */}
      <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-background/10">
        {loading ? (
          <SkeletonChart />
        ) : children ? (
          <div className="p-3">{children}</div>
        ) : (
          <PlaceholderFrame hint={emptyHint ?? "Wykres podpinamy w następnym kroku."} />
        )}
      </div>

      {/* “Telemetry” footer */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-background/10 px-3 py-2">
        <span className="text-[11px] text-muted-foreground">
          Render: <span className="text-foreground">client</span>
        </span>
        <span className="text-[11px] text-muted-foreground">
          Status:{" "}
          <span className={loading ? "text-yellow-300" : "text-muted-foreground"}>
            {loading ? "fetching signals…" : "awaiting uplink"}
          </span>
        </span>
      </div>
    </div>
  );
}

function PlaceholderFrame({ hint }: { hint: string }) {
  return (
    <div className="relative h-56">
      {/* subtelna siatka / “radar” */}
      <div className="absolute inset-0 opacity-[0.55]">
        <div className="h-full w-full bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.08),transparent_45%),radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.06),transparent_50%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:28px_28px]" />
      </div>

      <div className="relative flex h-full flex-col items-center justify-center px-6 text-center">
        <div className="grid h-11 w-11 place-items-center rounded-2xl border border-border bg-background/20">
          📡
        </div>
        <p className="mt-3 text-sm font-semibold">Uplink pending</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>

        <div className="mt-4 flex items-center gap-2 rounded-full border border-border bg-background/20 px-3 py-1 text-[11px] text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-foreground/25" />
          chart module reserved
        </div>
      </div>

      {/* sygnał na dole */}
      <div className="absolute bottom-3 left-3 right-3 h-[2px] overflow-hidden rounded-full bg-border">
        <div className="h-full w-1/3 rounded-full bg-foreground/15" />
      </div>
    </div>
  );
}

function SkeletonChart() {
  return (
    <div className="h-56 p-3">
      <div className="h-full rounded-2xl border border-border bg-background/20 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="h-3 w-32 rounded bg-background/30" />
          <div className="h-3 w-16 rounded bg-background/30" />
        </div>

        <div className="mt-4 grid h-[150px] grid-cols-12 items-end gap-1">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="rounded bg-background/30"
              style={{ height: `${20 + (i % 5) * 14}px` }}
            />
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="h-3 w-20 rounded bg-background/30" />
          <div className="h-3 w-24 rounded bg-background/30" />
        </div>
      </div>
    </div>
  );
}
