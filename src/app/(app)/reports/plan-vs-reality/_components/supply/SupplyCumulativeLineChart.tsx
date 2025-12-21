"use client";

type Point = {
  bucket_month: string;
  value: number; // kumulacja dostaw
};

type Props = {
  data: Point[];
  planTotal: number;
  height?: number;
};

function monthLabel(ymd: string): string {
  return ymd.slice(0, 7);
}

export default function SupplyCumulativeLineChart({ data, planTotal, height = 220 }: Props) {
  if (!data.length) {
    return <div className="text-sm text-foreground/60">Brak danych w tym zakresie.</div>;
  }

  const w = 900;
  const h = 260;
  const padL = 44;
  const padR = 14;
  const padT = 10;
  const padB = 36;

  const maxVal = Math.max(planTotal || 0, ...data.map((d) => d.value), 0) || 1;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  const xAt = (i: number) =>
    padL + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);

  const yAt = (v: number) => padT + innerH - (v / maxVal) * innerH;

  const path = data
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(p.value)}`)
    .join(" ");

  const yPlan = yAt(planTotal || 0);

  return (
    <div style={{ height }} className="w-full">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full">
        <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} stroke="currentColor" opacity="0.25" />
        <line x1={padL} y1={padT + innerH} x2={padL + innerW} y2={padT + innerH} stroke="currentColor" opacity="0.25" />

        <line
          x1={padL}
          y1={yPlan}
          x2={padL + innerW}
          y2={yPlan}
          stroke="currentColor"
          opacity="0.35"
          strokeDasharray="6 6"
        />
        <text
          x={padL + innerW - 2}
          y={Math.max(padT + 12, yPlan - 6)}
          textAnchor="end"
          fontSize="11"
          fill="currentColor"
          opacity="0.6"
        >
          plan: {Math.round(planTotal || 0)}
        </text>

        <path d={path} fill="none" stroke="currentColor" opacity="0.65" strokeWidth={2} />

        {data.map((p, i) => {
          const x = xAt(i);
          const y = yAt(p.value);
          const showLabel = i === 0 || i === data.length - 1 || data.length <= 6 || i % 2 === 0;

          return (
            <g key={`${p.bucket_month}-${i}`}>
              <circle cx={x} cy={y} r={3} fill="currentColor" opacity="0.85" />
              {showLabel && (
                <text x={x} y={padT + innerH + 18} textAnchor="middle" fontSize="11" fill="currentColor" opacity="0.6">
                  {monthLabel(p.bucket_month)}
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
