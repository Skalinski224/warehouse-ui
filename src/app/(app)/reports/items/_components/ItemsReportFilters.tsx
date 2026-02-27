// src/app/(app)/reports/items/_components/ItemsReportFilters.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Status = "active" | "deleted" | "all";
type Stock = "in" | "all";

type Props = {
  q: string;
  loc: string;
  status: Status;
  stock: Stock;
};

function buildUrl(pathname: string, sp: URLSearchParams) {
  const s = sp.toString();
  return s ? `${pathname}?${s}` : pathname;
}

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export default function ItemsReportFilters({ q, loc, status, stock }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [text, setText] = useState(q);
  const [locText, setLocText] = useState(loc);

  // sync (back/forward)
  useEffect(() => setText(q), [q]);
  useEffect(() => setLocText(loc), [loc]);

  const baseSp = useMemo(() => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("q");
    sp.delete("loc");
    return sp;
  }, [searchParams]);

  // debounce q + loc
  useEffect(() => {
    const t = setTimeout(() => {
      const sp = new URLSearchParams(baseSp.toString());

      const qq = text.trim();
      const ll = locText.trim();

      if (qq) sp.set("q", qq);
      else sp.delete("q");

      if (ll) sp.set("loc", ll);
      else sp.delete("loc");

      router.replace(buildUrl(pathname, sp), { scroll: false });
    }, 250);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, locText]);

  const setStatus = (v: Status) => {
    const sp = new URLSearchParams(searchParams.toString());
    if (v === "active") sp.delete("status"); // default
    else sp.set("status", v);
    router.replace(buildUrl(pathname, sp), { scroll: false });
  };

  const setStock = (v: Stock) => {
    const sp = new URLSearchParams(searchParams.toString());
    if (v === "all") sp.delete("stock"); // default
    else sp.set("stock", v);
    router.replace(buildUrl(pathname, sp), { scroll: false });
  };

  const clearAll = () => {
    router.replace(pathname, { scroll: false });
    setText("");
    setLocText("");
  };

  const btnBase =
    "inline-flex items-center justify-center h-9 px-3 rounded-lg border text-sm transition " +
    "focus:outline-none focus:ring-2 focus:ring-foreground/30";

  const btnGhost = cls(btnBase, "border-border bg-background/20 hover:bg-background/35");
  const btnActiveNeutral = cls(btnBase, "border-border bg-card text-foreground");
  const btnActiveGreen = cls(
    btnBase,
    "border-emerald-500/35 bg-emerald-600/15 text-emerald-200 hover:bg-emerald-600/22"
  );
  const btnActiveRed = cls(btnBase, "border-red-500/35 bg-red-600/15 text-red-200 hover:bg-red-600/22");

  return (
    <div className="space-y-3">
      {/* SEARCH + LOC + CLEAR */}
      <div className="grid gap-3 md:grid-cols-12">
        <label className="grid gap-1 md:col-span-5">
          <span className="text-xs opacity-70">Szukaj</span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Wpisz nazwę materiału lub ID…"
            className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
          />
        </label>

        <label className="grid gap-1 md:col-span-4">
          <span className="text-xs opacity-70">Lokalizacja</span>
          <input
            value={locText}
            onChange={(e) => setLocText(e.target.value)}
            placeholder="np. Magazyn A…"
            className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
          />
        </label>

        <div className="md:col-span-3 flex items-end justify-end pr-1">
          <button type="button" onClick={clearAll} className={cls(btnGhost, "mr-1")}>
            Wyczyść
          </button>
        </div>
      </div>

      {/* STATUS + STOCK */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] opacity-70 mr-1">Status:</span>

        <button
          type="button"
          onClick={() => setStatus("active")}
          className={status === "active" ? btnActiveGreen : btnGhost}
        >
          Aktywne
        </button>

        <button
          type="button"
          onClick={() => setStatus("deleted")}
          className={status === "deleted" ? btnActiveRed : btnGhost}
        >
          Usunięte
        </button>

        <button
          type="button"
          onClick={() => setStatus("all")}
          className={status === "all" ? btnActiveNeutral : btnGhost}
        >
          Wszystkie
        </button>

        <span className="mx-2 opacity-40">•</span>

        <span className="text-[11px] opacity-70 mr-1">Magazyn:</span>

        <button
          type="button"
          onClick={() => setStock("all")}
          className={stock === "all" ? btnActiveNeutral : btnGhost}
        >
          Wszystkie
        </button>

        <button
          type="button"
          onClick={() => setStock("in")}
          className={stock === "in" ? btnActiveNeutral : btnGhost}
        >
          Tylko na stanie
        </button>
      </div>
    </div>
  );
}