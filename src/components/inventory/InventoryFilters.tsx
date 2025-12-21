"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Status = "all" | "draft" | "approved";

function getSP(sp: ReturnType<typeof useSearchParams>, key: string) {
  const v = sp.get(key);
  return v && v.trim() ? v : "";
}

export default function InventoryFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Status>("all");

  // sync local state with URL (back/forward, linki, etc.)
  useEffect(() => {
    setFrom(getSP(sp, "from"));
    setTo(getSP(sp, "to"));
    setQ(getSP(sp, "q"));

    const st = (getSP(sp, "status") as Status) || "all";
    setStatus(st === "draft" || st === "approved" || st === "all" ? st : "all");
  }, [sp]);

  function pushParams() {
    const usp = new URLSearchParams(sp.toString());

    const setOrDelete = (k: string, v: string) => {
      const val = v.trim();
      if (!val) usp.delete(k);
      else usp.set(k, val);
    };

    setOrDelete("from", from);
    setOrDelete("to", to);
    setOrDelete("q", q);

    if (!status || status === "all") usp.delete("status");
    else usp.set("status", status);

    // reset paging on filter change
    usp.delete("offset");

    const qs = usp.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function onApply(e: React.FormEvent) {
    e.preventDefault();
    pushParams();
  }

  function onReset() {
    router.push(pathname);
  }

  return (
    <form onSubmit={onApply} className="card p-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <label className="space-y-1">
          <div className="text-[11px] text-muted-foreground">Od</div>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-2 py-2 text-xs"
          />
        </label>

        <label className="space-y-1">
          <div className="text-[11px] text-muted-foreground">Do</div>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-2 py-2 text-xs"
          />
        </label>

        <label className="space-y-1">
          <div className="text-[11px] text-muted-foreground">Szukaj</div>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Osoba lub opis…"
            className="w-full rounded-md border border-border bg-background px-2 py-2 text-xs"
          />
        </label>

        <label className="space-y-1">
          <div className="text-[11px] text-muted-foreground">Status</div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as Status)}
            className="w-full rounded-md border border-border bg-background px-2 py-2 text-xs"
          >
            <option value="all">Wszystkie</option>
            <option value="draft">Draft</option>
            <option value="approved">Zatwierdzone</option>
          </select>
        </label>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onReset}
          className="rounded-md border border-border px-3 py-2 text-xs"
        >
          Wyczyść
        </button>

        <button
          type="submit"
          className="rounded-md border border-border bg-card px-3 py-2 text-xs font-medium"
        >
          Zastosuj
        </button>
      </div>
    </form>
  );
}
