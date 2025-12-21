// src/app/(app)/reports/items/_components/ItemsReportFilters.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Props = {
  q: string;
  status: "active" | "deleted" | "all";
  stock: "in" | "all";
};

function buildUrl(pathname: string, sp: URLSearchParams) {
  const s = sp.toString();
  return s ? `${pathname}?${s}` : pathname;
}

export default function ItemsReportFilters({ q, status, stock }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [text, setText] = useState(q);

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      const sp = new URLSearchParams(searchParams.toString());

      if (text.trim()) sp.set("q", text.trim());
      else sp.delete("q");

      router.replace(buildUrl(pathname, sp), { scroll: false });
    }, 250);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const setStatus = (v: Props["status"]) => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("status", v);
    router.replace(buildUrl(pathname, sp), { scroll: false });
  };

  const setStock = (v: Props["stock"]) => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("stock", v);
    router.replace(buildUrl(pathname, sp), { scroll: false });
  };

  const clearAll = () => {
    router.replace(pathname, { scroll: false });
    setText("");
  };

  /* ================== KLASY (KANON) ================== */

  const baseBtn =
    "rounded-md border px-3 py-2 text-xs transition";

  const idleBtn =
    `${baseBtn} border-border text-muted-foreground hover:text-foreground`;

  const activeNeutral =
    `${baseBtn} border-border bg-card text-foreground`;

  const activeGreen =
    `${baseBtn} border-emerald-500/50 bg-emerald-500/15 text-emerald-300`;

  const activeRed =
    `${baseBtn} border-red-500/50 bg-red-500/15 text-red-300`;

  return (
    <div className="card p-3 space-y-3">
      {/* SEARCH */}
      <div className="grid gap-3 md:grid-cols-3">
        <label className="md:col-span-2 space-y-1">
          <div className="text-[11px] text-muted-foreground">Szukaj</div>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Wpisz nazwę materiału…"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs"
          />
        </label>

        <div className="space-y-1">
          <div className="text-[11px] text-muted-foreground">Szybkie akcje</div>
          <button
            type="button"
            onClick={clearAll}
            className={`${baseBtn} w-full border-border text-muted-foreground hover:text-foreground`}
          >
            Wyczyść filtry
          </button>
        </div>
      </div>

      {/* STATUS + STOCK */}
      <div className="flex flex-wrap items-center gap-2">
        {/* STATUS */}
        <span className="text-[11px] text-muted-foreground mr-1">
          Status:
        </span>

        <button
          type="button"
          onClick={() => setStatus("active")}
          className={
            status === "active" ? activeGreen : idleBtn
          }
        >
          Aktywne
        </button>

        <button
          type="button"
          onClick={() => setStatus("deleted")}
          className={
            status === "deleted" ? activeRed : idleBtn
          }
        >
          Usunięte
        </button>

        <button
          type="button"
          onClick={() => setStatus("all")}
          className={
            status === "all" ? activeNeutral : idleBtn
          }
        >
          Wszystkie
        </button>

        <span className="mx-2 text-muted-foreground">•</span>

        {/* STOCK */}
        <span className="text-[11px] text-muted-foreground mr-1">
          Magazyn:
        </span>

        <button
          type="button"
          onClick={() => setStock("all")}
          className={stock === "all" ? activeNeutral : idleBtn}
        >
          Wszystkie
        </button>

        <button
          type="button"
          onClick={() => setStock("in")}
          className={stock === "in" ? activeNeutral : idleBtn}
        >
          Tylko na stanie
        </button>
      </div>
    </div>
  );
}
