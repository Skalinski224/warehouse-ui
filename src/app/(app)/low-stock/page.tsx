// src/app/(app)/low-stock/page.tsx
import Link from "next/link";
import { supabaseServer } from "@/lib/supabaseServer";

type Row = {
  id: string;
  title: string;
  image_url: string | null;
  unit: string;
  base_quantity: number | string;     // Supabase numeric -> string w runtime
  current_quantity: number | string;  // jw.
  stock_pct: number | string;         // jw.
  deleted_at: string | null;
};

export default async function Page() {
  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from("v_materials_overview")
    .select(
      "id,title,image_url,unit,base_quantity,current_quantity,stock_pct,deleted_at"
    )
    .lte("stock_pct", 25)                 // ≤ 25% zapasu
    .is("deleted_at", null)              // TYLKO aktywne materiały
    .order("stock_pct", { ascending: true });

  if (error) {
    return (
      <div className="p-6 space-y-2">
        <h1 className="text-2xl font-semibold">Co się kończy</h1>
        <p className="text-sm text-red-400">Błąd: {error.message}</p>
      </div>
    );
  }

  // Konwersje numeric(string)->number
  const items = (data ?? [])
    .map((r: Row) => {
      const base =
        typeof r.base_quantity === "string"
          ? parseFloat(r.base_quantity)
          : r.base_quantity ?? 0;
      const curr =
        typeof r.current_quantity === "string"
          ? parseFloat(r.current_quantity)
          : r.current_quantity ?? 0;
      const pctRaw =
        typeof r.stock_pct === "string"
          ? parseFloat(r.stock_pct)
          : r.stock_pct ?? 0;
      const pct = Math.max(0, Math.min(100, Math.round(pctRaw)));

      // odrzucamy dziwne rekordy bez bazy
      if (!base || base <= 0) return null;

      return {
        id: r.id,
        title: r.title,
        image_url: r.image_url,
        unit: r.unit,
        base,
        curr,
        pct,
      };
    })
    .filter(Boolean) as {
    id: string;
    title: string;
    image_url: string | null;
    unit: string;
    base: number;
    curr: number;
    pct: number;
  }[];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Co się kończy</h1>

      {items.length === 0 ? (
        <p className="text-sm opacity-70">
          Obecnie żadna pozycja nie spadła poniżej 25% stanu bazowego.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((m) => {
            const pctSafe = Math.max(0, Math.min(100, m.pct));

            return (
              <li
                key={m.id}
                className="rounded border border-border bg-card overflow-hidden"
              >
                <Link href={`/materials/${m.id}`} className="block group">
                  <div className="relative">
                    <div className="aspect-square w-full bg-background/50 flex items-center justify-center text-xs opacity-60">
                      {m.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.image_url}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : (
                        <span>brak miniatury</span>
                      )}
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium line-clamp-1">{m.title}</div>
                      <span className="text-[11px] px-2 py-1 rounded bg-background/60 border border-border">
                        {m.unit}
                      </span>
                    </div>

                    <div className="mt-1 text-sm opacity-80">
                      {m.curr} / {m.base} {m.unit} ({pctSafe}%)
                    </div>

                    <div className="mt-2 h-2 rounded bg-background/60 overflow-hidden">
                      <div
                        className={`h-full ${
                          pctSafe <= 25 ? "bg-red-500/70" : "bg-foreground/70"
                        }`}
                        style={{ width: `${pctSafe}%` }}
                      />
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
