// src/app/low-stock/page.tsx
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";

export default async function Page() {
  // POBIERAMY Z WIDOKU:
  const { data, error } = await supabase
    .from("low_stock")
    .select("id, name, base_quantity, current_quantity, unit, image_url");

  if (error) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Co się kończy</h1>
        <p className="text-sm text-red-400">Błąd: {error.message}</p>
      </div>
    );
  }

  const items = (data ?? [])
    .filter((m) => m.base_quantity > 0 && m.current_quantity / m.base_quantity < 0.25)
    .sort(
      (a, b) =>
        a.current_quantity / a.base_quantity - b.current_quantity / b.base_quantity
    );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Co się kończy</h1>

      {items.length === 0 ? (
        <p className="text-sm text-white/60">
          Obecnie żadna pozycja nie spadła poniżej 25% stanu bazowego.
        </p>
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((m) => {
            const pct = Math.max(
              0,
              Math.min(100, Math.round((m.current_quantity / m.base_quantity) * 100))
            );
            const barColor =
              pct < 15 ? "bg-red-500" : pct < 25 ? "bg-amber-500" : "bg-emerald-500";

            return (
              <li key={m.id}>
                <Link
                  href={`/materials/${m.id}`}
                  className="block rounded-2xl border border-white/10 bg-white/5 p-5 shadow-sm transition hover:bg-white/[0.07]"
                >
                  {/* miniatura */}
                  <div className="mb-3 aspect-video w-full overflow-hidden rounded-lg bg-white/5 grid place-items-center">
                    {m.image_url ? (
                      <Image
                        src={m.image_url}
                        alt={m.name}
                        width={640}
                        height={360}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-sm text-white/40">brak miniatury</span>
                    )}
                  </div>

                  {/* nazwa + jednostka */}
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-base text-white/90">
                      {m.name}
                    </h3>
                    <span className="text-xs sm:text-sm px-2 py-0.5 rounded-md bg-white/10 text-white/70 font-medium tracking-wide">
                      {m.unit ?? "—"}
                    </span>
                  </div>

                  {/* stan + pasek */}
                  <div className="text-sm text-white/70">
                    Stan:{" "}
                    <span className="text-white/90">
                      {m.current_quantity} / {m.base_quantity}
                    </span>{" "}
                    ({pct}%)
                  </div>
                  <div className="mt-2 h-2 w-full rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={`h-full ${barColor}`}
                      style={{ width: `${pct}%` }}
                    />
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
