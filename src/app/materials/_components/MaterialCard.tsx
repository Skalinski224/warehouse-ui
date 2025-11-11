import Link from "next/link";

export function MaterialCard({
  id,
  name,
  unit,
  base_quantity,
  current_quantity,
  image_url,
}: {
  id: string;
  name: string;
  unit: string;
  base_quantity: number;
  current_quantity: number;
  image_url: string | null;
}) {
  const pct =
    base_quantity > 0
      ? Math.round((current_quantity / base_quantity) * 100)
      : 0;

  const clamped = Math.min(100, Math.max(0, pct));
  const bar =
    clamped < 25 ? "bg-red-500" : clamped < 60 ? "bg-yellow-500" : "bg-green-500";

  return (
    <Link
      href={`/materials/${id}`}
      className="block rounded-2xl border border-border bg-card p-3 hover:bg-foreground/[0.04] transition"
    >
      <div className="mb-3 aspect-square overflow-hidden rounded-xl bg-foreground/[0.04] flex items-center justify-center text-xs text-foreground/60">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {image_url ? (
          <img src={image_url} alt={name} className="h-full w-full object-cover" />
        ) : (
          "brak miniatury"
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold">{name}</div>
        <span className="text-xs px-2 py-0.5 rounded bg-foreground/[0.08]">
          {unit}
        </span>
      </div>

      <div className="mt-1 text-sm text-foreground/70">
        Stan: {current_quantity} / {base_quantity} ({clamped}%)
      </div>

      <div className="mt-2 h-2 rounded bg-foreground/[0.08] overflow-hidden">
        <div className={`h-full ${bar}`} style={{ width: `${clamped}%` }} />
      </div>
    </Link>
  );
}
