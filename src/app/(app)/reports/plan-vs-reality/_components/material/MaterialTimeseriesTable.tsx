"use client";

import type { DesignerDashTimeseriesPoint } from "@/lib/dto/designerDash";

type Props = {
  timeseries: DesignerDashTimeseriesPoint[];
};

function monthLabel(ymd: string): string {
  return ymd.slice(0, 7);
}

export default function MaterialTimeseriesTable({ timeseries }: Props) {
  const rows = [...timeseries].sort((a, b) => a.bucket_month.localeCompare(b.bucket_month));

  if (!rows.length) {
    return <div className="text-sm text-foreground/60">Brak danych w tym zakresie.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-foreground/60">
          <tr className="border-b border-border">
            <th className="text-left py-2 pr-3">Miesiąc</th>
            <th className="text-right py-2 px-3">Zużycie</th>
            <th className="text-right py-2 pl-3">Dostawy</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.bucket_month} className="border-b border-border/60">
              <td className="py-2 pr-3 font-mono">{monthLabel(r.bucket_month)}</td>
              <td className="py-2 px-3 text-right font-mono">{Math.round(r.used_qty ?? 0)}</td>
              <td className="py-2 pl-3 text-right font-mono">{Math.round(r.delivered_qty ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
