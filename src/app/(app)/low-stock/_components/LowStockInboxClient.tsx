// src/app/(app)/low-stock/_components/LowStockInboxClient.tsx
"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

function clampPct(p: number) {
  return Math.max(0, Math.min(100, p));
}

export type LowStockInboxItem = {
  event_id: string;
  material_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  unit: string;
  base: number;
  curr: number;
  pct: number;
  inventory_location_label: string;
  acknowledged_at: string | null;
};

export default function LowStockInboxClient({
  initialItems,
  ackLowStockAction,
}: {
  initialItems: LowStockInboxItem[];
  ackLowStockAction: (eventIds: string[]) => Promise<void>;
}) {
  const [items, setItems] = useState<LowStockInboxItem[]>(initialItems);
  const [isPending, startTransition] = useTransition();

  const fresh = useMemo(() => items.filter((x) => !x.acknowledged_at), [items]);
  const seen = useMemo(() => items.filter((x) => !!x.acknowledged_at), [items]);

  function markAckLocal(eventIds: string[]) {
    const now = new Date().toISOString();
    setItems((prev) =>
      prev.map((x) => (eventIds.includes(x.event_id) ? { ...x, acknowledged_at: now } : x))
    );
  }

  async function ack(eventIds: string[]) {
    if (!eventIds.length) return;

    // ✅ optymistycznie od razu
    markAckLocal(eventIds);

    startTransition(async () => {
      try {
        await ackLowStockAction(eventIds);
      } catch {
        // jak backend padnie: cofamy optymistykę (żeby nie kłamać)
        setItems((prev) =>
          prev.map((x) => (eventIds.includes(x.event_id) ? { ...x, acknowledged_at: null } : x))
        );
      }
    });
  }

  function WhiteButton({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={cx(
          "inline-flex items-center justify-center rounded-2xl px-3 py-2 text-sm font-semibold transition",
          "border border-black/10 bg-white text-black hover:bg-white/90",
          disabled ? "opacity-60 pointer-events-none" : ""
        )}
      >
        {children}
      </button>
    );
  }

  function Card({ m, showAck }: { m: LowStockInboxItem; showAck: boolean }) {
    const pctSafe = clampPct(m.pct);

    return (
      <li
        key={m.event_id}
        className="rounded-2xl border border-border bg-card overflow-hidden transition hover:bg-background/10 hover:border-border/80"
      >
        <div className="p-4">
          <div className="flex gap-4">
            <div className="w-28 h-28 rounded-xl overflow-hidden bg-background/50 border border-border flex-shrink-0 relative">
              {m.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.image_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-xs opacity-60">brak zdjęcia</div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/materials/${m.material_id}`} className="font-semibold truncate hover:underline block">
                    {m.title}
                  </Link>

                  {m.description ? (
                    <div className="mt-1 text-sm opacity-80 line-clamp-2">{m.description}</div>
                  ) : (
                    <div className="mt-1 text-sm opacity-50 line-clamp-2">—</div>
                  )}
                </div>

                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="text-[11px] px-2 py-1 rounded bg-background/60 border border-border">{m.unit}</span>

                  <span className="text-[10px] px-2 py-1 rounded border border-emerald-500/35 bg-emerald-500/10 text-emerald-300">
                    {m.inventory_location_label}
                  </span>
                </div>
              </div>

              <div className="mt-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm opacity-70">Stan</span>
                    <span className="text-sm font-medium truncate">
                      {m.curr} / {m.base} {m.unit}
                    </span>
                  </div>
                  <div className="text-sm font-medium opacity-80 flex-shrink-0">{pctSafe}%</div>
                </div>

                <div className="mt-2 h-2 rounded bg-background/60 overflow-hidden">
                  <div
                    className={`h-full ${pctSafe <= 25 ? "bg-red-500/70" : "bg-foreground/70"}`}
                    style={{ width: `${pctSafe}%` }}
                  />
                </div>
              </div>

              {showAck ? (
                <div className="mt-4 flex items-center justify-end">
                  <WhiteButton disabled={isPending} onClick={() => ack([m.event_id])}>
                    Potwierdź
                  </WhiteButton>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </li>
    );
  }

  return (
    <div className="space-y-6">
      {/* ✅ NOWE — bez tła, tylko nagłówek + przycisk + lista */}
      {fresh.length > 0 ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold">Nowe</div>
              <div className="text-xs opacity-70 mt-1">Pozycje, których jeszcze nie potwierdziłeś.</div>
            </div>

            <WhiteButton disabled={isPending} onClick={() => ack(fresh.map((x) => x.event_id))}>
              Potwierdź wszystkie
            </WhiteButton>
          </div>

          <ul className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {fresh.map((m) => (
              <Card key={m.event_id} m={m} showAck />
            ))}
          </ul>
        </section>
      ) : null}

      {/* ✅ WIDZIANE */}
      <section className="space-y-4">
        <div className="text-lg font-semibold">Widziane</div>

        {seen.length === 0 && fresh.length === 0 ? (
          <p className="text-sm opacity-70">Obecnie żadna pozycja nie spadła poniżej ustalonego stanu bazowego.</p>
        ) : seen.length === 0 ? (
          <p className="text-sm opacity-70">Brak pozycji oznaczonych jako widziane.</p>
        ) : (
          <ul className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {seen.map((m) => (
              <Card key={m.event_id} m={m} showAck={false} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}