// src/app/(app)/reports/inventory/_components/InventoryReportsFilters.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Props = {
  initialFrom: string;
  initialTo: string;
  initialQ: string;
};

export default function InventoryReportsFilters({
  initialFrom,
  initialTo,
  initialQ,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [q, setQ] = useState(initialQ);

  // jeśli user wejdzie w URL z parametrami / wstecz-przód, zsynchronizuj stan
  useEffect(() => setFrom(initialFrom), [initialFrom]);
  useEffect(() => setTo(initialTo), [initialTo]);
  useEffect(() => setQ(initialQ), [initialQ]);

  const baseParams = useMemo(() => {
    const p = new URLSearchParams(sp.toString());
    // zostawiamy ewentualne inne parametry, ale nadpisujemy te 3
    p.delete("from");
    p.delete("to");
    p.delete("q");
    return p;
  }, [sp]);

  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams(baseParams.toString());

      const f = from.trim();
      const tt = to.trim();
      const qq = q.trim();

      if (f) params.set("from", f);
      if (tt) params.set("to", tt);
      if (qq) params.set("q", qq);

      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    }, 250); // "na każdą literę" ale bez DDOS — lekki debounce

    return () => clearTimeout(t);
  }, [from, to, q, router, pathname, baseParams]);

  function clearAll() {
    setFrom("");
    setTo("");
    setQ("");
  }

  return (
    <div className="card p-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <label className="space-y-1 block">
          <div className="text-[11px] text-muted-foreground">Od</div>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs"
          />
        </label>

        <label className="space-y-1 block">
          <div className="text-[11px] text-muted-foreground">Do</div>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs"
          />
        </label>

        <label className="space-y-1 block md:col-span-2">
          <div className="text-[11px] text-muted-foreground">Szukaj (kto / opis)</div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="np. Przemysław, dostawa, piwnica..."
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs"
          />
        </label>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={clearAll}
          className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
        >
          Wyczyść
        </button>
      </div>
    </div>
  );
}
