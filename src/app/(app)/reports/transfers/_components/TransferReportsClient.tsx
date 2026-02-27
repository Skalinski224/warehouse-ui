// src/app/(app)/reports/transfers/_components/TransferReportsClient.tsx
"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useEffect } from "react";

/* ---------------------------------- TYPES --------------------------------- */

export type TransferDayRow = {
  day: string; // date or timestamptz-ish string
  created_by: string | null;

  created_by_name: string | null;
  created_by_email: string | null;

  from_location_id: string | null;
  to_location_id: string | null;

  from_location_label: string | null;
  to_location_label: string | null;

  transfers_count: number | string | null;
  qty_total: number | string | null;
  last_at: string | null;
};

type LocationOption = { id: string; label: string };

type SortKey = "day" | "person" | "route" | "count" | "qty";
type SortDir = "asc" | "desc";

type Props = {
  rows: TransferDayRow[];
  locations: LocationOption[];
};

/* ---------------------------------- UI HELPERS (KANON) --------------------------------- */

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function Pill({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "ok" | "warn" | "bad";
  className?: string;
}) {
  const base =
    "inline-flex items-center gap-1 text-[12px] leading-none px-2.5 py-1 rounded-full border whitespace-nowrap";
  const toneCls =
    tone === "ok"
      ? "border-emerald-500/40 bg-emerald-600/10 text-emerald-200"
      : tone === "warn"
      ? "border-amber-500/40 bg-amber-600/10 text-amber-200"
      : tone === "bad"
      ? "border-red-500/40 bg-red-600/10 text-red-200"
      : "border-border bg-background/30 text-foreground/80";

  return <span className={cls(base, toneCls, className)}>{children}</span>;
}

function Kpi({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  tone?: "neutral" | "ok" | "warn" | "bad";
}) {
  const toneCls =
    tone === "ok"
      ? "bg-emerald-600/10 border-emerald-500/30"
      : tone === "warn"
      ? "bg-amber-600/10 border-amber-500/30"
      : tone === "bad"
      ? "bg-red-600/10 border-red-500/30"
      : "bg-background/20 border-border";

  return (
    <div className={cls("rounded-xl border px-3 py-2", toneCls)}>
      <div className="text-[11px] opacity-70">{label}</div>
      <div className="text-sm font-semibold leading-tight">{value}</div>
    </div>
  );
}

/* ---------------------------------- HELPERS --------------------------------- */

function toISODateOnly(value: string) {
  const iso = String(value ?? "");
  return iso.slice(0, 10);
}

function fmtDay(value: string) {
  const iso = String(value ?? "");
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pl-PL", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function fmtDateTime(value: string | null) {
  if (!value) return "—";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("pl-PL");
}

function toNum(v: number | string | null): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function actorLabel(r: TransferDayRow): string {
  const name = (r.created_by_name ?? "").trim();
  if (name) return name;
  const email = (r.created_by_email ?? "").trim();
  if (email) return email;
  return String(r.created_by ?? "—");
}

/* ---------------------------------- VIEW --------------------------------- */

export default function TransferReportsClient({ rows, locations }: Props) {
  const [filtersOpen, setFiltersOpen] = useState(false);

  // filtry
  const [stateFilter, setStateFilter] = useState<"active" | "all">("active");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [locationId, setLocationId] = useState<string>("all");
  const [query, setQuery] = useState<string>("");

  // sort
  const [sortKey, setSortKey] = useState<SortKey>("day");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // UX drawer (jak deliveries)
  useEffect(() => {
    if (!filtersOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFiltersOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtersOpen]);

  useEffect(() => {
    if (!filtersOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [filtersOpen]);

  const firstOpenRef = useRef(true);
  useEffect(() => {
    if (!filtersOpen) firstOpenRef.current = true;
  }, [filtersOpen]);

  const btnBase =
    "inline-flex items-center justify-center h-9 px-3 rounded-lg border text-sm transition " +
    "focus:outline-none focus:ring-2 focus:ring-foreground/30 disabled:opacity-50 disabled:pointer-events-none";

  const btnPrimary = cls(
    btnBase,
    "border-emerald-500/35 bg-emerald-600/15 text-emerald-200 hover:bg-emerald-600/22"
  );
  const btnGhost = cls(btnBase, "border-border bg-background/20 hover:bg-background/35");
  const btnDetails = cls(
    btnBase,
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/14"
  );

  const clearAll = () => {
    setStateFilter("active");
    setFrom("");
    setTo("");
    setLocationId("all");
    setQuery("");
    setSortKey("day");
    setSortDir("desc");
  };

  const filtered = useMemo(() => {
    let out = [...(rows ?? [])];

    if (stateFilter === "active") {
      out = out.filter((r) => {
        const c = toNum(r.transfers_count ?? 0);
        const q = toNum(r.qty_total ?? 0);
        return c > 0 || q > 0;
      });
    }

    const fromISO = from?.trim() ? from.trim() : "";
    const toISO = to?.trim() ? to.trim() : "";
    if (fromISO) out = out.filter((r) => toISODateOnly(String(r.day)) >= fromISO);
    if (toISO) out = out.filter((r) => toISODateOnly(String(r.day)) <= toISO);

    if (locationId !== "all") {
      out = out.filter(
        (r) =>
          String(r.from_location_id ?? "") === locationId ||
          String(r.to_location_id ?? "") === locationId
      );
    }

    const q = query.trim().toLowerCase();
    if (q) {
      out = out.filter((r) => {
        const day = toISODateOnly(String(r.day));
        const who = actorLabel(r);
        const fromL = String(r.from_location_label ?? r.from_location_id ?? "");
        const toL = String(r.to_location_label ?? r.to_location_id ?? "");
        const blob = `${day} ${who} ${fromL} ${toL} ${r.from_location_id ?? ""} ${r.to_location_id ?? ""}`;
        return blob.toLowerCase().includes(q);
      });
    }

    out.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;

      const aDay = toISODateOnly(String(a.day));
      const bDay = toISODateOnly(String(b.day));

      const aWho = actorLabel(a);
      const bWho = actorLabel(b);

      const aRoute = `${a.from_location_label ?? a.from_location_id ?? ""}→${a.to_location_label ?? a.to_location_id ?? ""}`;
      const bRoute = `${b.from_location_label ?? b.from_location_id ?? ""}→${b.to_location_label ?? b.to_location_id ?? ""}`;

      const aCount = toNum(a.transfers_count ?? 0);
      const bCount = toNum(b.transfers_count ?? 0);

      const aQty = toNum(a.qty_total ?? 0);
      const bQty = toNum(b.qty_total ?? 0);

      if (sortKey === "day") return aDay.localeCompare(bDay) * dir;
      if (sortKey === "person") return aWho.localeCompare(bWho, "pl") * dir;
      if (sortKey === "route") return aRoute.localeCompare(bRoute, "pl") * dir;
      if (sortKey === "count") return (aCount - bCount) * dir;
      return (aQty - bQty) * dir;
    });

    return out;
  }, [rows, stateFilter, from, to, locationId, query, sortKey, sortDir]);

  const count = filtered.length;

  const countActive = useMemo(() => {
    const base = [...(rows ?? [])];
    return base.filter((r) => {
      const c = toNum(r.transfers_count ?? 0);
      const q = toNum(r.qty_total ?? 0);
      return c > 0 || q > 0;
    }).length;
  }, [rows]);

  const totalMoves = useMemo(() => filtered.reduce((acc, r) => acc + toNum(r.transfers_count), 0), [
    filtered,
  ]);
  const totalQty = useMemo(() => filtered.reduce((acc, r) => acc + toNum(r.qty_total), 0), [
    filtered,
  ]);

  return (
    <main className="space-y-4">
      {/* KPI jak w deliveries (desktop) */}
      <div className="hidden md:grid grid-cols-4 gap-2">
        <Kpi label="Wynik" value={count} />
        <Kpi label="Aktywne (globalnie)" value={countActive} tone="ok" />
        <Kpi label="Suma pozycji" value={totalMoves} tone="ok" />
        <Kpi label="Suma ilości" value={totalQty} tone="ok" />
      </div>

      <section className="rounded-2xl border border-border bg-card overflow-hidden">
        {/* TOP BAR (kanon) */}
        <div className="p-3 md:p-4 border-b border-border bg-background/10">
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Szukaj: data / osoba / lokalizacja…"
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
              />
            </div>

            <button
              type="button"
              className={cls("md:hidden", btnGhost, "h-10")}
              onClick={() => setFiltersOpen(true)}
            >
              Filtry <span className="opacity-70">☰</span>
            </button>
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px] opacity-70">
            <span>Wyników: {count}</span>
            <span className="md:hidden">
              Pozycji: {totalMoves} • Ilość: {totalQty}
            </span>
          </div>
        </div>

        {/* DESKTOP: panel filtrów (kanon) */}
        <div className="hidden md:block p-3 md:p-4 border-b border-border bg-background/5">
          <div className="grid gap-3 md:grid-cols-12">
            <label className="grid gap-1 md:col-span-3">
              <span className="text-xs opacity-70">Stan</span>
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value as any)}
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
              >
                <option value="active">Aktywne</option>
                <option value="all">Wszystkie</option>
              </select>
            </label>

            <label className="grid gap-1 md:col-span-3">
              <span className="text-xs opacity-70">Od</span>
              <input
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                type="date"
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
              />
            </label>

            <label className="grid gap-1 md:col-span-3">
              <span className="text-xs opacity-70">Do</span>
              <input
                value={to}
                onChange={(e) => setTo(e.target.value)}
                type="date"
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
              />
            </label>

            <label className="grid gap-1 md:col-span-3">
              <span className="text-xs opacity-70">Lokalizacja (skąd lub dokąd)</span>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
              >
                <option value="all">Wszystkie</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 md:col-span-3">
              <span className="text-xs opacity-70">Sortuj</span>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
              >
                <option value="day">Data</option>
                <option value="route">Trasa</option>
                <option value="person">Osoba</option>
                <option value="count">Pozycji</option>
                <option value="qty">Ilość</option>
              </select>
            </label>

            <label className="grid gap-1 md:col-span-3">
              <span className="text-xs opacity-70">Kierunek</span>
              <select
                value={sortDir}
                onChange={(e) => setSortDir(e.target.value as SortDir)}
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
              >
                <option value="asc">Rosnąco</option>
                <option value="desc">Malejąco</option>
              </select>
            </label>

            <div className="md:col-span-12 flex items-center justify-end gap-2 pt-1 pr-1">
              <button type="button" onClick={clearAll} className={cls(btnGhost, "mr-1")}>
                Wyczyść
              </button>
            </div>
          </div>
        </div>

        {/* LISTA */}
        <div className="p-3 md:p-4 space-y-3">
          {count === 0 && (
            <div className="rounded-2xl border border-border bg-background/20 p-4 text-sm opacity-70">
              Brak wyników — zmień filtry.
            </div>
          )}

          {filtered.map((r) => {
            const fromId = String(r.from_location_id ?? "");
            const toId = String(r.to_location_id ?? "");
            const fromLabel = String(r.from_location_label ?? r.from_location_id ?? "—");
            const toLabel = String(r.to_location_label ?? r.to_location_id ?? "—");

            const dayOnly = toISODateOnly(String(r.day));

            const who = actorLabel(r);
            const createdBy = String(r.created_by ?? "—"); // segment url

            const href = `/reports/transfers/${encodeURIComponent(dayOnly)}/${encodeURIComponent(
              createdBy
            )}/${encodeURIComponent(fromId)}/${encodeURIComponent(toId)}`;

            const key = `${dayOnly}-${createdBy}-${fromId}-${toId}`;

            const countItems = toNum(r.transfers_count ?? 0);
            const qty = toNum(r.qty_total ?? 0);

            return (
              <Link
                key={key}
                href={href}
                className={cls(
                  "block rounded-2xl border border-border bg-background/10 p-4",
                  "hover:bg-background/18 hover:border-border/90 transition",
                  "focus:outline-none focus:ring-2 focus:ring-foreground/30"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="min-w-0">
                        <div className="text-[11px] uppercase tracking-wide opacity-60">Trasa</div>
                        <div className="text-sm font-semibold truncate">
                          {fromLabel} <span className="opacity-60">→</span> {toLabel}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <Pill tone="ok">Pozycji: {countItems}</Pill>
                        <Pill tone="ok">Ilość: {qty}</Pill>
                      </div>
                    </div>

                    <div className="mt-2 grid gap-1 text-xs opacity-80">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="opacity-60">Kto:</span>
                        <span className="font-medium">{who}</span>
                        <span className="opacity-50">•</span>
                        <span className="opacity-60">Kiedy:</span>
                        <span className="font-medium">{fmtDay(String(r.day))}</span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="opacity-60">Ostatni wpis:</span>
                        <span className="font-medium">{fmtDateTime(r.last_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="hidden md:flex flex-col items-end gap-2 shrink-0">
                    <span className={cls(btnDetails, "px-3")}>Szczegóły →</span>
                  </div>
                </div>

                <div className="mt-4 md:hidden flex items-center gap-2 flex-wrap justify-end">
                  <span className={cls(btnDetails, "px-3")}>Szczegóły →</span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* MOBILE: DRAWER FILTRÓW (kanon) */}
      {filtersOpen && (
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/60" onClick={() => setFiltersOpen(false)} />

          <div
            className={cls(
              "absolute top-0 right-0 h-full w-[min(420px,100%)]",
              "bg-card border-l border-border shadow-2xl",
              "overflow-y-auto",
              "translate-x-0 animate-[transfersFilterSlideIn_.18s_ease-out]"
            )}
          >
            <div className="flex items-center justify-between p-4 border-b border-border bg-background/10">
              <div className="text-base font-semibold">Filtry</div>
              <button
                type="button"
                className={cls(btnGhost, "h-9 w-9 px-0")}
                onClick={() => setFiltersOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid gap-3">
                <label className="grid gap-1">
                  <span className="text-xs opacity-70">Szukaj</span>
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="data / osoba / lokalizacja…"
                    className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                    autoFocus={firstOpenRef.current}
                    onFocus={() => {
                      firstOpenRef.current = false;
                    }}
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-1">
                    <span className="text-xs opacity-70">Od</span>
                    <input
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                      type="date"
                      className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs opacity-70">Do</span>
                    <input
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                      type="date"
                      className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                    />
                  </label>
                </div>

                <label className="grid gap-1">
                  <span className="text-xs opacity-70">Stan</span>
                  <select
                    value={stateFilter}
                    onChange={(e) => setStateFilter(e.target.value as any)}
                    className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  >
                    <option value="active">Aktywne</option>
                    <option value="all">Wszystkie</option>
                  </select>
                </label>

                <label className="grid gap-1">
                  <span className="text-xs opacity-70">Lokalizacja</span>
                  <select
                    value={locationId}
                    onChange={(e) => setLocationId(e.target.value)}
                    className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  >
                    <option value="all">Wszystkie</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1">
                  <span className="text-xs opacity-70">Sortuj</span>
                  <select
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value as SortKey)}
                    className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  >
                    <option value="day">Data</option>
                    <option value="route">Trasa</option>
                    <option value="person">Osoba</option>
                    <option value="count">Pozycji</option>
                    <option value="qty">Ilość</option>
                  </select>
                </label>

                <label className="grid gap-1">
                  <span className="text-xs opacity-70">Kierunek</span>
                  <select
                    value={sortDir}
                    onChange={(e) => setSortDir(e.target.value as SortDir)}
                    className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  >
                    <option value="asc">Rosnąco</option>
                    <option value="desc">Malejąco</option>
                  </select>
                </label>

                <div className="text-xs opacity-60">
                  Filtry działają na żywo. „Zastosuj” tylko zamyka panel.
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-border bg-background/10 flex items-center justify-between gap-2">
              <button type="button" className={btnGhost} onClick={clearAll}>
                Wyczyść
              </button>

              <button type="button" className={btnPrimary} onClick={() => setFiltersOpen(false)}>
                Zastosuj
              </button>
            </div>
          </div>

          <style jsx>{`
            @keyframes transfersFilterSlideIn_ {
              from {
                transform: translateX(28px);
                opacity: 0;
              }
              to {
                transform: translateX(0);
                opacity: 1;
              }
            }
          `}</style>
        </div>
      )}
    </main>
  );
}