// src/app/(app)/analyze/metrics/_components/MetricsLayout.tsx
// Client Layout — topbar (FiltersBar) + left nav (MetricsTabs) + content (children)

"use client";

import type { ReactNode } from "react";
import FiltersBar from "./FiltersBar";
import MetricsTabs from "./MetricsTabs";

export type ViewKey =
  | "project"
  | "plan-vs-reality"
  | "usage"
  | "anomalies"
  | "inventory-health"
  | "deliveries-control";

type Props = {
  title: string;
  subtitle?: string | null;

  view: ViewKey;
  from: string | null; // YYYY-MM-DD
  to: string | null; // YYYY-MM-DD
  place: string | null;

  children: ReactNode;
};

export default function MetricsLayout({
  title,
  subtitle,
  view,
  from,
  to,
  place,
  children,
}: Props) {
  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="card p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold">{title}</h1>
              <span className="inline-flex items-center rounded-full border border-border bg-background/40 px-2 py-0.5 text-[11px] text-muted-foreground">
                Mission Control
              </span>
            </div>
            {subtitle ? (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Panel sterowania metrykami projektu. Bez lania wody — same sygnały.
              </p>
            )}
          </div>

          <FiltersBar view={view} from={from} to={to} place={place} />
        </div>
      </div>

      {/* Main */}
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-3">
          <div className="card p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground">
                Widoki analityczne
              </p>
              <span className="text-[11px] text-muted-foreground">v1</span>
            </div>

            <div className="mt-3">
              <MetricsTabs activeView={view} />
            </div>
          </div>

          <div className="card p-3">
            <p className="text-xs font-semibold">Jak to czytać</p>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              <li>
                • Najpierw <span className="text-foreground">STATUS</span>, potem{" "}
                <span className="text-foreground">KPI</span>, na końcu{" "}
                <span className="text-foreground">drill-down</span>.
              </li>
              <li>• Filtry zapisują się w URL (łatwo podlinkować widok).</li>
              <li>• Kolory: zielony / żółty / czerwony — reszta to szum.</li>
            </ul>
          </div>
        </aside>

        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
