// src/components/ProgressBar.tsx
export default function ProgressBar({
    value,
    label,
  }: {
    value: number; // 0-100
    label?: string;
  }) {
    const v = Math.max(0, Math.min(100, Math.round(value)));
    return (
      <div className="w-full">
        {label ? (
          <div className="flex justify-between text-xs text-zinc-400 mb-1">
            <span>{label}</span>
            <span>{v}%</span>
          </div>
        ) : (
          <div className="text-right text-xs text-zinc-400 mb-1">{v}%</div>
        )}
        <div className="h-2 w-full rounded bg-zinc-800/60">
          <div
            className="h-2 rounded bg-zinc-200"
            style={{ width: `${v}%` }}
            aria-valuenow={v}
            aria-valuemin={0}
            aria-valuemax={100}
            role="progressbar"
          />
        </div>
      </div>
    );
  }
  