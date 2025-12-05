// src/components/Materials/MaterialCard.tsx
import Link from "next/link";

export type MaterialCardProps = {
  id: string;
  title: string;
  unit: string;
  base_quantity: number | string;
  current_quantity: number | string;
  image_url?: string | null;
  deleted_at?: string | null;
  /** Domyślnie '/materials'; można podmienić bazę ścieżki */
  hrefBase?: string;
  className?: string;
};

export default function MaterialCard({
  id,
  title,
  unit,
  base_quantity,
  current_quantity,
  image_url,
  deleted_at,
  hrefBase = "/materials",
  className = "",
}: MaterialCardProps) {
  const base = Number(base_quantity) || 0;
  const curr = Number(current_quantity) || 0;
  const pct = base > 0 ? Math.round((curr / base) * 100) : 0;

  return (
    <li className={`rounded border border-border bg-card overflow-hidden ${className}`}>
      <Link href={`${hrefBase}/${id}`} className="block group">
        {/* Miniatura 1:1 */}
        <div className="relative">
          <div className="aspect-square w-full bg-background/50 flex items-center justify-center text-xs opacity-60">
            {image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={image_url}
                alt=""
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
              />
            ) : (
              <span>brak miniatury</span>
            )}
          </div>

          {/* Wstążka „usunięty” */}
          {deleted_at ? (
            <div className="absolute top-2 right-2 text-[11px] px-2 py-1 rounded bg-red-500/20 border border-red-500/30 text-red-200">
              usunięty
            </div>
          ) : null}
        </div>

        {/* Treść */}
        <div className={`p-4 ${deleted_at ? "opacity-75" : ""}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="font-medium line-clamp-1">{title}</div>
            <span className="text-[11px] px-2 py-1 rounded bg-background/60 border border-border">
              {unit}
            </span>
          </div>

          <div className="mt-1 text-sm opacity-80">
            {curr} / {base} {unit} ({pct}%)
          </div>

          {/* Pasek postępu */}
          <div className="mt-2 h-2 rounded bg-background/60 overflow-hidden">
            <div
              className={`h-full ${pct <= 25 ? "bg-red-500/70" : "bg-foreground/70"}`}
              style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
            />
          </div>
        </div>
      </Link>
    </li>
  );
}
