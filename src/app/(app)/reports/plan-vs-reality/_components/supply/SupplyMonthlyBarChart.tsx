"use client";

type Point = {
  bucket_month: string; // YYYY-MM-01
  value: number;
};

type Props = {
  data: Point[];
  height?: number;
};

function monthLabel(ymd: string): string {
  return ymd.slice(0, 7);
}

export default function SupplyMonthlyBarChart({ data, height = 220 }: Props) {
  if (!data.length) {
    return <div className="text-sm text-foreground/60">Brak danych w tym zakresie.</div>;
  }

  const w = 900;
  const h = 260;
  const padL = 44;
  const padR = 14;
  const padT = 10;
  const padB = 36;

  const maxVal = Math.max(...data.map((d) => d.value), 0) || 1;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  const barGap = 6;
  const barW = Math.max(6, Math.floor(innerW / data.length) - barGap);

  return (
    <div style={{ height }} className="w-full">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full">
        <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} stroke="currentColor" opacity="0.25" />
        <line x1={padL} y1={padT + innerH} x2={padL + innerW} y2={padT + innerH} stroke="currentColor" opacity="0.25" />

        {data.map((d, i) => {
          const x = padL + i * (barW + barGap);
          const bh = Math.round((d.value / maxVal) * innerH);
          const y = padT + innerH - bh;

          const label = monthLabel(d.bucket_month);
          const showLabel = i === 0 || i === data.length - 1 || data.length <= 6 || i % 2 === 0;

          return (
            <g key={`${d.bucket_month}-${i}`}>
              <rect x={x} y={y} width={barW} height={bh} rx={3} fill="currentColor" opacity="0.35" />
              {showLabel && (
                <text
                  x={x + barW / 2}
                  y={padT + innerH + 18}
                  textAnchor="middle"
                  fontSize="11"
                  fill="currentColor"
                  opacity="0.6"
                >
                  {label}
                </text>
              )}
            </g>
          );
        })}

        <text x={padL - 6} y={padT + 10} textAnchor="end" fontSize="11" fill="currentColor" opacity="0.6">
          {Math.round(maxVal)}
        </text>
        <text x={padL - 6} y={padT + innerH} textAnchor="end" fontSize="11" fill="currentColor" opacity="0.6">
          0
        </text>
      </svg>
    </div>
  );
}
