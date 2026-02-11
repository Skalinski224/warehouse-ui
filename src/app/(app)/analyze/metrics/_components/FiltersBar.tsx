"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ViewKey } from "./metrics.types";

type Props = {
  view: ViewKey;
  from: string | null; // YYYY-MM-DD
  to: string | null; // YYYY-MM-DD
  place: string | null;
};

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

function isISODate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function clampDate(v: string) {
  return isISODate(v) ? v : "";
}

function cleanText(v: string) {
  const s = v.trim();
  return s.length ? s : "";
}

function buildUrl(pathname: string, params: URLSearchParams) {
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export default function FiltersBar({ view, from, to, place }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const baseParams = useMemo(() => {
    const p = new URLSearchParams(sp?.toString() ?? "");
    p.set("view", view);
    return p;
  }, [sp, view]);

  const [fromLocal, setFromLocal] = useState(from ?? "");
  const [toLocal, setToLocal] = useState(to ?? "");
  const [placeLocal, setPlaceLocal] = useState(place ?? "");
  const [isPending, startTransition] = useTransition();

  useEffect(() => setFromLocal(from ?? ""), [from]);
  useEffect(() => setToLocal(to ?? ""), [to]);
  useEffect(() => setPlaceLocal(place ?? ""), [place]);

  const apply = (next: { from?: string; to?: string; place?: string }) => {
    const p = new URLSearchParams(baseParams);

    const f = next.from ?? fromLocal;
    const t = next.to ?? toLocal;
    const pl = next.place ?? placeLocal;

    const f2 = clampDate(f);
    const t2 = clampDate(t);
    const pl2 = cleanText(pl);

    if (f2) p.set("from", f2);
    else p.delete("from");

    if (t2) p.set("to", t2);
    else p.delete("to");

    if (pl2) p.set("place", pl2);
    else p.delete("place");

    const fFinal = p.get("from");
    const tFinal = p.get("to");
    if (fFinal && tFinal && fFinal > tFinal) {
      p.set("from", tFinal);
      p.set("to", fFinal);
      setFromLocal(tFinal);
      setToLocal(fFinal);
    }

    startTransition(() => {
      router.replace(buildUrl(pathname, p), { scroll: false });
    });
  };

  const quickRange = (days: number) => {
    const now = new Date();
    const toD = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    const fromD = new Date(toD);
    fromD.setUTCDate(fromD.getUTCDate() - days);

    const toISO = toD.toISOString().slice(0, 10);
    const fromISO = fromD.toISOString().slice(0, 10);

    setFromLocal(fromISO);
    setToLocal(toISO);
    apply({ from: fromISO, to: toISO });
  };

  const reset = () => {
    setFromLocal("");
    setToLocal("");
    setPlaceLocal("");

    const p = new URLSearchParams(baseParams);
    p.delete("from");
    p.delete("to");
    p.delete("place");

    startTransition(() => {
      router.replace(buildUrl(pathname, p), { scroll: false });
    });
  };

  const hasAny =
    (fromLocal && fromLocal.trim()) ||
    (toLocal && toLocal.trim()) ||
    (placeLocal && placeLocal.trim());

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-background/20 p-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">Od</span>
          <input
            type="date"
            value={fromLocal}
            onChange={(e) => setFromLocal(e.target.value)}
            onBlur={() => apply({})}
            className={cx(
              "h-9 rounded-xl border border-border bg-background/30 px-3 text-xs text-foreground outline-none",
              "focus:ring-2 focus:ring-ring/40"
            )}
          />
        </div>

        <div className="h-6 w-px bg-border" />

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">Do</span>
          <input
            type="date"
            value={toLocal}
            onChange={(e) => setToLocal(e.target.value)}
            onBlur={() => apply({})}
            className={cx(
              "h-9 rounded-xl border border-border bg-background/30 px-3 text-xs text-foreground outline-none",
              "focus:ring-2 focus:ring-ring/40"
            )}
          />
        </div>

        <button
          type="button"
          onClick={() => apply({})}
          disabled={isPending}
          className={cx(
            "ml-1 h-9 rounded-xl border border-border px-3 text-xs transition",
            "bg-card/40 hover:bg-card/60",
            isPending && "opacity-60"
          )}
          title="Zastosuj filtry"
        >
          {isPending ? "…" : "Zastosuj"}
        </button>
      </div>

      <div className="flex items-center gap-2 rounded-2xl border border-border bg-background/20 p-2">
        <span className="text-[11px] text-muted-foreground">Miejsce</span>
        <input
          value={placeLocal}
          onChange={(e) => setPlaceLocal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter")
              apply({ place: (e.target as HTMLInputElement).value });
          }}
          onBlur={() => apply({})}
          placeholder="np. Piwnica / Parter / Klatka A"
          className={cx(
            "h-9 w-[220px] rounded-xl border border-border bg-background/30 px-3 text-xs text-foreground outline-none",
            "focus:ring-2 focus:ring-ring/40"
          )}
        />
      </div>

      <div className="flex items-center gap-1 rounded-2xl border border-border bg-background/20 p-2">
        <span className="mr-1 text-[11px] text-muted-foreground">Szybko</span>
        <button
          type="button"
          onClick={() => quickRange(7)}
          className="h-9 rounded-xl border border-border bg-card/40 px-3 text-xs hover:bg-card/60"
          title="Ostatnie 7 dni"
        >
          7d
        </button>
        <button
          type="button"
          onClick={() => quickRange(30)}
          className="h-9 rounded-xl border border-border bg-card/40 px-3 text-xs hover:bg-card/60"
          title="Ostatnie 30 dni"
        >
          30d
        </button>
        <button
          type="button"
          onClick={() => quickRange(90)}
          className="h-9 rounded-xl border border-border bg-card/40 px-3 text-xs hover:bg-card/60"
          title="Ostatnie 90 dni"
        >
          90d
        </button>
      </div>

      <button
        type="button"
        onClick={reset}
        disabled={!hasAny || isPending}
        className={cx(
          "h-9 rounded-2xl border border-border px-3 text-xs transition",
          "bg-background/10 hover:bg-background/20",
          (!hasAny || isPending) && "opacity-50"
        )}
        title="Wyczyść filtry"
      >
        Reset
      </button>

      <span className="ml-1 inline-flex items-center gap-2 rounded-full border border-border bg-background/20 px-3 py-1 text-[11px] text-muted-foreground">
        <span
          className={cx(
            "h-2 w-2 rounded-full",
            isPending ? "bg-yellow-500/70" : "bg-foreground/25"
          )}
        />
        telemetry
      </span>
    </div>
  );
}
