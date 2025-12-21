// src/app/(app)/analyze/metrics/_components/ProjectStatusCard.tsx
// Client — Status projektu (kolor + powody + tooltip "jak liczymy status")

"use client";

import { useMemo, useState } from "react";
import type { ProjectMetricsDashRow } from "@/lib/dto/metrics";

type ProjectStatusLevel = "ok" | "warn" | "critical";
type ProjectStatusReason = {
  key: "over_plan" | "low_stock" | "approval_time";
  label: string;
  value: string;
  severity: ProjectStatusLevel;
};

type Props = {
  data: ProjectMetricsDashRow;
};

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

function fmtHours(v: number) {
  if (!Number.isFinite(v)) return "—";
  if (v < 1) return `${Math.round(v * 60)} min`;
  if (v < 24) return `${v.toFixed(1)} h`;
  return `${(v / 24).toFixed(1)} d`;
}

function pickLevel(reasons: ProjectStatusReason[]): ProjectStatusLevel {
  // Najgorszy wygrywa
  if (reasons.some((r) => r.severity === "critical")) return "critical";
  if (reasons.some((r) => r.severity === "warn")) return "warn";
  return "ok";
}

function levelLabel(level: ProjectStatusLevel) {
  if (level === "ok") return "STABILNIE";
  if (level === "warn") return "UWAGA";
  return "ALARM";
}

function levelAccent(level: ProjectStatusLevel) {
  if (level === "ok") return "bg-green-500/70";
  if (level === "warn") return "bg-yellow-500/75";
  return "bg-red-500/70";
}

function levelRing(level: ProjectStatusLevel) {
  if (level === "ok") return "ring-green-500/25";
  if (level === "warn") return "ring-yellow-500/25";
  return "ring-red-500/25";
}

function levelText(level: ProjectStatusLevel) {
  if (level === "ok") return "text-green-400";
  if (level === "warn") return "text-yellow-300";
  return "text-red-400";
}

function computeReasons(d: ProjectMetricsDashRow): ProjectStatusReason[] {
  // progi v1 (hardcoded)
  const overPlanCritical = (d.over_plan_count ?? 0) >= 3;
  const overPlanWarn = (d.over_plan_count ?? 0) >= 1;

  const lowStockCritical = (d.low_stock_count ?? 0) >= 5;
  const lowStockWarn = (d.low_stock_count ?? 0) >= 1;

  const approvalCritical = (d.avg_approval_hours ?? 0) >= 24;
  const approvalWarn = (d.avg_approval_hours ?? 0) >= 6;

  return [
    {
      key: "over_plan",
      label: "Plan",
      value: `${d.over_plan_count ?? 0} over / ${d.within_plan_count ?? 0} within`,
      severity: overPlanCritical ? "critical" : overPlanWarn ? "warn" : "ok",
    },
    {
      key: "low_stock",
      label: "Low stock",
      value: `${d.low_stock_count ?? 0}`,
      severity: lowStockCritical ? "critical" : lowStockWarn ? "warn" : "ok",
    },
    {
      key: "approval_time",
      label: "Zatwierdzenia",
      value: fmtHours(d.avg_approval_hours ?? 0),
      severity: approvalCritical ? "critical" : approvalWarn ? "warn" : "ok",
    },
  ];
}

function severityDot(sev: ProjectStatusLevel) {
  if (sev === "ok") return "bg-green-500/70";
  if (sev === "warn") return "bg-yellow-500/75";
  return "bg-red-500/70";
}

export default function ProjectStatusCard({ data }: Props) {
  const [open, setOpen] = useState(false);

  const reasons = useMemo(() => computeReasons(data), [data]);
  const level = useMemo(() => pickLevel(reasons), [reasons]);

  const headline =
    level === "ok"
      ? "Projekt wygląda zdrowo."
      : level === "warn"
      ? "Projekt wymaga uwagi."
      : "Projekt ma krytyczne ryzyka.";

  const sub =
    level === "ok"
      ? "Trzymaj tempo — ale patrz na sygnały zanim zrobi się pożar."
      : level === "warn"
      ? "Coś zaczyna się rozjeżdżać. Lepiej złapać to teraz."
      : "Są czerwone flagi. Jeśli nic nie zrobisz, to uderzy w termin/koszt.";

  return (
    <div className="card p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span
              className={cx(
                "relative inline-flex h-8 w-8 items-center justify-center rounded-2xl border border-border bg-background/30",
                "ring-1",
                levelRing(level)
              )}
              aria-hidden
            >
              <span className={cx("h-2.5 w-2.5 rounded-full", levelAccent(level))} />
              <span
                className={cx(
                  "absolute inset-0 rounded-2xl",
                  "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                )}
              />
            </span>

            <div>
              <p className="text-xs font-semibold text-muted-foreground">STATUS SYSTEMU</p>
              <div className="flex items-center gap-2">
                <h2 className={cx("text-base font-semibold", levelText(level))}>
                  {levelLabel(level)}
                </h2>
                <span className="text-xs text-muted-foreground">{headline}</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">{sub}</p>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={cx(
              "inline-flex items-center gap-2 rounded-2xl border border-border px-3 py-2 text-xs",
              "bg-background/10 hover:bg-background/20 transition",
              "focus:outline-none focus:ring-2 focus:ring-ring/40"
            )}
            aria-expanded={open}
            aria-label="Jak liczymy status?"
            title="Jak liczymy status?"
          >
            <span className="inline-block h-2 w-2 rounded-full bg-foreground/25" />
            Jak liczymy status
            <span className="text-muted-foreground">{open ? "▲" : "▼"}</span>
          </button>

          {open && (
            <div
              className={cx(
                "absolute right-0 z-50 mt-2 w-[340px] rounded-2xl border border-border bg-card/90 p-3",
                "shadow-lg backdrop-blur"
              )}
              role="dialog"
            >
              <p className="text-xs font-semibold">Progi (v1)</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Status to <span className="text-foreground">najgorszy</span> z 3 sygnałów:
                plan, low stock, czas zatwierdzeń.
              </p>

              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                <li>
                  • <span className="text-foreground">Plan</span>:{" "}
                  <span className="text-yellow-300">warn</span> jeśli{" "}
                  <span className="text-foreground">over_plan ≥ 1</span>,{" "}
                  <span className="text-red-400">critical</span> jeśli{" "}
                  <span className="text-foreground">over_plan ≥ 3</span>
                </li>
                <li>
                  • <span className="text-foreground">Low stock</span>:{" "}
                  <span className="text-yellow-300">warn</span> jeśli{" "}
                  <span className="text-foreground">≥ 1</span>,{" "}
                  <span className="text-red-400">critical</span> jeśli{" "}
                  <span className="text-foreground">≥ 5</span>
                </li>
                <li>
                  • <span className="text-foreground">Zatwierdzenia</span>:{" "}
                  <span className="text-yellow-300">warn</span> jeśli{" "}
                  <span className="text-foreground">avg ≥ 6h</span>,{" "}
                  <span className="text-red-400">critical</span> jeśli{" "}
                  <span className="text-foreground">avg ≥ 24h</span>
                </li>
              </ul>

              <div className="mt-3 rounded-xl border border-border bg-background/20 p-2">
                <p className="text-[11px] text-muted-foreground">
                  Docelowo progi przeniesiemy do ustawień konta (account_settings) — ale v1 ma
                  działać od razu.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Reasons */}
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {reasons.map((r) => (
          <div
            key={r.key}
            className={cx(
              "rounded-2xl border border-border bg-background/10 p-3",
              "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold">{r.label}</p>
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/20 px-2 py-0.5 text-[10px] text-muted-foreground">
                <span className={cx("h-2 w-2 rounded-full", severityDot(r.severity))} />
                {r.severity.toUpperCase()}
              </span>
            </div>

            <p className="mt-2 text-sm font-semibold text-foreground">{r.value}</p>

            <p className="mt-1 text-[11px] text-muted-foreground">
              {r.key === "over_plan"
                ? "Ile grup materiałów przekroczyło plan."
                : r.key === "low_stock"
                ? "Ile pozycji magazynu jest ≤25% bazy."
                : "Średni czas zatwierdzania (deliveries + daily reports)."}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
