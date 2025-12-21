"use client";

import type { DesignerDashOverviewRow } from "@/lib/dto/designerDash";

type Props = {
  rows: DesignerDashOverviewRow[];
  onPickFamily?: (familyKey: string) => void;
};

function toNum(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v) || 0;
  return 0;
}

function fmtDate(v: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export default function DeviationsTable({ rows, onPickFamily }: Props) {
  const mapped = rows.map((r) => {
    const planned = toNum(r.planned_qty);
    const used = toNum(r.used_qty);
    const delivered = toNum(r.delivered_qty);
    return {
      ...r,
      _planned: planned,
      _used: used,
      _delivered: delivered,
      _overPlan: used - planned,        // >0 = przekroczony plan
      _supplyGap: used - delivered,     // >0 = zużycie > dostawy
    };
  });

  const overPlan = mapped.filter((r) => r._overPlan > 0).sort((a, b) => b._overPlan - a._overPlan).slice(0, 10);
  const supplyGap = mapped.filter((r) => r._supplyGap > 0).sort((a, b) => b._supplyGap - a._supplyGap).slice(0, 10);

  const Section = ({
    title,
    rows,
    valueLabel,
    valueOf,
    dateLabel,
    dateOf,
  }: {
    title: string;
    rows: typeof mapped;
    valueLabel: string;
    valueOf: (r: (typeof mapped)[number]) => number;
    dateLabel: string;
    dateOf: (r: (typeof mapped)[number]) => string | null;
  }) => {
    if (!rows.length) {
      return (
        <div className="card p-4">
          <div className="text-sm font-semibold">{title}</div>
          <div className="mt-2 text-sm text-foreground/60">Brak pozycji w tym zakresie.</div>
        </div>
      );
    }

    return (
      <div className="card p-4">
        <div className="text-sm font-semibold">{title}</div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-foreground/60">
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-3">Materiał / rodzina</th>
                <th className="text-right py-2 px-3">{valueLabel}</th>
                <th className="text-right py-2 pl-3">{dateLabel}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={`${title}-${r.family_key}`}
                  className={`border-b border-border/60 hover:bg-card/60 ${onPickFamily ? "cursor-pointer" : ""}`}
                  onClick={() => onPickFamily?.(r.family_key)}
                >
                  <td className="py-2 pr-3">
                    <div className="font-medium">{r.rep_title ?? r.family_key}</div>
                    <div className="text-xs text-foreground/60 font-mono">{r.family_key}</div>
                  </td>
                  <td className="py-2 px-3 text-right font-mono">{Math.round(valueOf(r))}</td>
                  <td className="py-2 pl-3 text-right text-xs text-foreground/70">{fmtDate(dateOf(r))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section
        title="Przekroczone planem (Top 10)"
        rows={overPlan}
        valueLabel="Nadmiar"
        valueOf={(r) => r._overPlan}
        dateLabel="Ostatnie użycie"
        dateOf={(r) => r.last_usage_at}
      />

      <Section
        title="Zużycie > dostawy (Top 10)"
        rows={supplyGap}
        valueLabel="Brakujące"
        valueOf={(r) => r._supplyGap}
        dateLabel="Ostatnia dostawa"
        dateOf={(r) => r.last_delivery_at}
      />
    </div>
  );
}
