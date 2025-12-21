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

function pct(used: number, planned: number): number | null {
  if (!planned || planned <= 0) return null;
  return (used / planned) * 100;
}

function fmtDate(v: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export default function UsageTable({ rows, onPickFamily }: Props) {
  const top = [...rows]
    .map((r) => {
      const planned = toNum(r.planned_qty);
      const used = toNum(r.used_qty);
      return {
        ...r,
        _planned: planned,
        _used: used,
        _pct: pct(used, planned),
      };
    })
    .sort((a, b) => (b._pct ?? -1) - (a._pct ?? -1))
    .slice(0, 10);

  if (!top.length) {
    return <div className="text-sm text-foreground/60">Brak pozycji w planie.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-foreground/60">
          <tr className="border-b border-border">
            <th className="text-left py-2 pr-3">Materiał / rodzina</th>
            <th className="text-right py-2 px-3">Plan</th>
            <th className="text-right py-2 px-3">Zużyto</th>
            <th className="text-right py-2 px-3">% planu</th>
            <th className="text-right py-2 pl-3">Ostatnie użycie</th>
          </tr>
        </thead>
        <tbody>
          {top.map((r) => {
            const p = r._pct;
            return (
              <tr
                key={r.family_key}
                className={`border-b border-border/60 hover:bg-card/60 ${
                  onPickFamily ? "cursor-pointer" : ""
                }`}
                onClick={() => onPickFamily?.(r.family_key)}
              >
                <td className="py-2 pr-3">
                  <div className="font-medium">
                    {r.rep_title ?? r.family_key}
                  </div>
                  <div className="text-xs text-foreground/60 font-mono">
                    {r.family_key}
                  </div>
                </td>
                <td className="py-2 px-3 text-right font-mono">{Math.round(r._planned)}</td>
                <td className="py-2 px-3 text-right font-mono">{Math.round(r._used)}</td>
                <td className="py-2 px-3 text-right font-mono">
                  {p == null ? "—" : `${p.toFixed(1)}%`}
                </td>
                <td className="py-2 pl-3 text-right text-xs text-foreground/70">
                  {fmtDate(r.last_usage_at)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
