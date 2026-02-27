// src/app/(app)/reports/deliveries/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import ApproveButton from "@/components/ApproveButton";
import RoleGuard from "@/components/RoleGuard";
import DeliveryInvoicesOverlay from "@/components/DeliveryInvoicesOverlay";

import { approveDelivery, markDeliveryPaid } from "@/lib/actions";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { PERM } from "@/lib/permissions";

type Row = {
  id: string;
  date: string | null;
  place_label: string | null;
  person: string | null;
  supplier: string | null;
  delivery_cost: number | string | null;
  materials_cost: number | string | null;
  approved: boolean | null;
  deleted_at: string | null;

  inventory_location_id: string | null;
  inventory_location_label: string | null;

  is_paid: boolean | null;
  payment_due_date: string | null;
  payment_status: string | null;
  days_to_due: number | string | null;
  is_overdue: boolean | null;

  items_count?: number | string | null;
};

type StatusFilter = "all" | "pending" | "approved";

/* ---------------------------------- UI HELPERS --------------------------------- */

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

/* ---------------------------------- HELPERY --------------------------------- */

function isLikelyId(s: string) {
  return /^[0-9a-f-]{8,}$/i.test(s);
}

function toNum(v: number | string | null): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pl-PL");
}

function paymentTone(r: Row): "neutral" | "ok" | "warn" | "bad" {
  if (r.deleted_at) return "neutral";
  if (r.is_paid) return "ok";
  if (r.is_overdue) return "bad";
  return "warn";
}

function paymentText(r: Row): string {
  if (r.deleted_at) return "Usunięta";
  return r.is_paid ? "Opłacona" : "Nieopłacona";
}

function approveText(r: Row): string {
  return r.approved ? "Zatwierdzona" : "Oczekuje";
}

async function fetchRows(params: {
  from?: string;
  to?: string;
  person?: string;
  inventory_location?: string;
  status?: StatusFilter;
  q?: string;
}): Promise<{ rows: Row[]; error: string | null }> {
  const supabase = supabaseBrowser();

  let q = supabase
    .from("v_deliveries_overview")
    .select(
      [
        "id",
        "date",
        "place_label",
        "person",
        "supplier",
        "delivery_cost",
        "materials_cost",
        "approved",
        "deleted_at",
        "inventory_location_id",
        "inventory_location_label",
        "is_paid",
        "payment_due_date",
        "payment_status",
        "days_to_due",
        "is_overdue",
        "items_count",
      ].join(", ")
    )
    .is("deleted_at", null)
    .order("date", { ascending: false })
    .limit(100);

  if (params.from) q = q.gte("date", params.from);
  if (params.to) q = q.lte("date", params.to);

  if (params.inventory_location && params.inventory_location.trim()) {
    const s = params.inventory_location.trim();
    q = q.ilike("inventory_location_label", `%${s}%`);
  }

  if (params.person && params.person.trim()) {
    const p = params.person.trim();
    q = q.ilike("person", `%${p}%`);
  }

  if (params.status === "approved") q = q.eq("approved", true);
  if (params.status === "pending") q = q.eq("approved", false);

  if (params.q && params.q.trim()) {
    const s = params.q.trim();
    if (isLikelyId(s)) {
      q = q.eq("id", s);
    } else {
      q = q.or(
        [
          `person.ilike.%${s}%`,
          `inventory_location_label.ilike.%${s}%`,
          `place_label.ilike.%${s}%`,
          `supplier.ilike.%${s}%`,
        ].join(",")
      );
    }
  }

  const { data, error } = (await q) as { data: Row[] | null; error: any };
  if (error) {
    console.error("reports/deliveries fetch error:", error);
    return { rows: [], error: error.message ?? String(error) };
  }

  return { rows: (data ?? []) as Row[], error: null };
}

function mkUrl(params: {
  from: string;
  to: string;
  person: string;
  inventory_location: string;
  status: StatusFilter;
  q: string;
}) {
  const p = new URLSearchParams();
  if (params.from.trim()) p.set("from", params.from.trim());
  if (params.to.trim()) p.set("to", params.to.trim());
  if (params.person.trim()) p.set("person", params.person.trim());
  if (params.inventory_location.trim()) p.set("loc", params.inventory_location.trim());
  if (params.status && params.status !== "all") p.set("status", params.status);
  if (params.q.trim()) p.set("q", params.q.trim());
  const qs = p.toString();
  return qs ? `/reports/deliveries?${qs}` : `/reports/deliveries`;
}

/* ---------------------------------- VIEW --------------------------------- */

function DeliveriesReportInner() {
  const router = useRouter();
  const sp = useSearchParams();

  const initial = useMemo(() => {
    const get = (k: string) => sp.get(k) ?? "";
    const status = (sp.get("status") as StatusFilter | null) ?? "all";
    return {
      from: get("from"),
      to: get("to"),
      person: get("person"),
      inventory_location: get("loc"),
      status: (status === "pending" || status === "approved" || status === "all"
        ? status
        : "all") as StatusFilter,
      q: get("q"),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [person, setPerson] = useState(initial.person);
  const [inventoryLocation, setInventoryLocation] = useState(initial.inventory_location);
  const [status, setStatus] = useState<StatusFilter>(initial.status);
  const [query, setQuery] = useState(initial.q);

  const [rows, setRows] = useState<Row[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [filtersOpen, setFiltersOpen] = useState(false);

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

  const debounceRef = useRef<number | null>(null);
  const lastUrlRef = useRef<string>("");

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);

    debounceRef.current = window.setTimeout(async () => {
      const nextUrl = mkUrl({
        from,
        to,
        person,
        inventory_location: inventoryLocation,
        status,
        q: query,
      });
      if (lastUrlRef.current !== nextUrl) {
        lastUrlRef.current = nextUrl;
        router.replace(nextUrl, { scroll: false });
      }

      setLoading(true);
      const res = await fetchRows({
        from,
        to,
        person,
        inventory_location: inventoryLocation,
        status,
        q: query,
      });
      setRows(res.rows);
      setLoadError(res.error);
      setLoading(false);
    }, 250);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [from, to, person, inventoryLocation, status, query, router]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await fetchRows({
        from,
        to,
        person,
        inventory_location: inventoryLocation,
        status,
        q: query,
      });
      setRows(res.rows);
      setLoadError(res.error);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fmtCurrency = useMemo(
    () =>
      new Intl.NumberFormat("pl-PL", {
        style: "currency",
        currency: "PLN",
        maximumFractionDigits: 2,
      }),
    []
  );

  const countApproved = useMemo(() => rows.filter((r) => !!r.approved).length, [rows]);
  const countPending = useMemo(() => rows.filter((r) => !r.approved).length, [rows]);

  const btnBase =
    "inline-flex items-center justify-center h-9 px-3 rounded-lg border text-sm transition " +
    "focus:outline-none focus:ring-2 focus:ring-foreground/30 disabled:opacity-50 disabled:pointer-events-none";

  // ✅ Dokumenty: lekko przezroczysty biały
  const btnDocs = cls(btnBase, "border-white/20 bg-white/10 text-white hover:bg-white/15");

  // ✅ Szczegóły: lekko przezroczysty zielony (bardziej subtelny niż primary)
  const btnDetails = cls(
    btnBase,
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/14"
  );

  // ✅ Primary (np. Akceptuj)
  const btnPrimary = cls(
    btnBase,
    "border-emerald-500/35 bg-emerald-600/15 text-emerald-200 hover:bg-emerald-600/22"
  );

  // ✅ Warn (opłać)
  const btnWarn = cls(
    btnBase,
    "border-amber-500/35 bg-amber-600/15 text-amber-200 hover:bg-amber-600/22"
  );

  // ✅ Ghost
  const btnGhost = cls(btnBase, "border-border bg-background/20 hover:bg-background/35");

  const clearAll = () => {
    setFrom("");
    setTo("");
    setPerson("");
    setInventoryLocation("");
    setStatus("all");
    setQuery("");
  };

  return (
    <main className="space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-base font-semibold leading-tight">Dostawy</h1>
          <p className="text-xs opacity-70 mt-1">
            Raport dostaw (max 100). Filtry działają na żywo — kliknij w wiersz, aby zobaczyć
            szczegóły.
          </p>
        </div>

        <div className="hidden md:grid grid-cols-3 gap-2">
          <Kpi label="Wynik" value={loading ? "…" : rows.length} />
          <Kpi label="Zatwierdzone" value={countApproved} tone="ok" />
          <Kpi label="Oczekujące" value={countPending} tone="warn" />
        </div>
      </header>

      <section className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="p-3 md:p-4 border-b border-border bg-background/10">
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Szukaj: osoba / lokalizacja / plac / dostawca / ID…"
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
            <span>{loading ? "Ładuję…" : `Wyników: ${rows.length} (max 100)`}</span>
            <span className="md:hidden">
              Zatw.: {countApproved} • Oczek.: {countPending}
            </span>
          </div>
        </div>

        <div className="hidden md:block p-3 md:p-4 border-b border-border bg-background/5">
          <div className="grid gap-3 md:grid-cols-12">
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

            <label className="grid gap-1 md:col-span-2">
              <span className="text-xs opacity-70">Status</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as StatusFilter)}
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
              >
                <option value="all">Wszystkie</option>
                <option value="pending">Oczekujące</option>
                <option value="approved">Zatwierdzone</option>
              </select>
            </label>

            <label className="grid gap-1 md:col-span-2">
              <span className="text-xs opacity-70">Osoba</span>
              <input
                value={person}
                onChange={(e) => setPerson(e.target.value)}
                placeholder="np. Kowalski"
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
              />
            </label>

            <label className="grid gap-1 md:col-span-2">
              <span className="text-xs opacity-70">Lokalizacja</span>
              <input
                value={inventoryLocation}
                onChange={(e) => setInventoryLocation(e.target.value)}
                placeholder="np. Magazyn A"
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
              />
            </label>

            {/* ✅ delikatnie odsunięte od lewej krawędzi */}
            <div className="md:col-span-12 flex items-center justify-end gap-2 pt-1 pr-1">
              <button type="button" onClick={clearAll} className={cls(btnGhost, "mr-1")}>
                Wyczyść
              </button>
            </div>
          </div>
        </div>

        <div className="p-3 md:p-4 space-y-3">
          {loadError && (
            <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
              Błąd ładowania dostaw: {loadError}
            </div>
          )}

          {!loadError && rows.length === 0 && !loading && (
            <div className="rounded-2xl border border-border bg-background/20 p-4 text-sm opacity-70">
              Brak wyników — zmień filtry.
            </div>
          )}

          {rows.map((r) => {
            const materialsCost = toNum(r.materials_cost ?? 0);
            const deliveryCost = toNum(r.delivery_cost ?? 0);
            const total = materialsCost + deliveryCost;

            const loc = r.inventory_location_label || "—";
            const who = r.person || "—";
            const when = fmtDate(r.date);
            const supplier = r.supplier || "—";
            const place = r.place_label || "—";

            const paidText = paymentText(r);
            const paidTone = paymentTone(r);
            const approvedText = approveText(r);

            const href = `/reports/deliveries/${r.id}`;

            return (
              <Link
                key={r.id}
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
                        <div className="text-[11px] uppercase tracking-wide opacity-60">
                          Lokalizacja magazynowa
                        </div>
                        <div className="text-sm font-semibold truncate">{loc}</div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <Pill tone={r.approved ? "ok" : "warn"}>{approvedText}</Pill>
                        <Pill tone={paidTone}>{paidText}</Pill>
                      </div>
                    </div>

                    <div className="mt-2 grid gap-1 text-xs opacity-80">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="opacity-60">Kto:</span>
                        <span className="font-medium">{who}</span>
                        <span className="opacity-50">•</span>
                        <span className="opacity-60">Kiedy:</span>
                        <span className="font-medium">{when}</span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="opacity-60">Plac:</span>
                        <span className="font-medium">{place}</span>
                        <span className="opacity-50">•</span>
                        <span className="opacity-60">Dostawca:</span>
                        <span className="font-medium">{supplier}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="text-right">
                      <div className="text-[11px] opacity-60">Razem</div>
                      <div className="text-sm font-semibold">{fmtCurrency.format(total)}</div>
                      <div className="hidden md:block text-[11px] opacity-70 mt-1">
                        Mat.: {fmtCurrency.format(materialsCost)} • Dost.:{" "}
                        {fmtCurrency.format(deliveryCost)}
                      </div>
                    </div>

                    <div className="hidden md:flex items-center gap-2 flex-wrap justify-end">
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                        }}
                      >
                        <DeliveryInvoicesOverlay
                          deliveryId={r.id}
                          triggerLabel="Dokumenty"
                          triggerClassName={btnDocs}
                        />
                      </span>

                      {!r.is_paid && (
                        <form
                          action={markDeliveryPaid}
                          onClick={(e) => e.stopPropagation()}
                          onSubmit={(e) => e.stopPropagation()}
                        >
                          <input type="hidden" name="delivery_id" value={r.id} />
                          <button type="submit" className={btnWarn}>
                            Oznacz opłaconą
                          </button>
                        </form>
                      )}

                      {!r.approved && (
                        <form
                          action={approveDelivery}
                          onClick={(e) => e.stopPropagation()}
                          onSubmit={(e) => e.stopPropagation()}
                        >
                          <input type="hidden" name="delivery_id" value={r.id} />
                          <ApproveButton className={btnPrimary as any}>Akceptuj</ApproveButton>
                        </form>
                      )}

                      <span className={cls(btnDetails, "px-3")}>Szczegóły →</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 md:hidden flex items-center gap-2 flex-wrap justify-end">
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                  >
                    <DeliveryInvoicesOverlay
                      deliveryId={r.id}
                      triggerLabel="Dokumenty"
                      triggerClassName={btnDocs}
                    />
                  </span>

                  {!r.is_paid && (
                    <form
                      action={markDeliveryPaid}
                      onClick={(e) => e.stopPropagation()}
                      onSubmit={(e) => e.stopPropagation()}
                    >
                      <input type="hidden" name="delivery_id" value={r.id} />
                      <button type="submit" className={btnWarn}>
                        Oznacz opłaconą
                      </button>
                    </form>
                  )}

                  {!r.approved && (
                    <form
                      action={approveDelivery}
                      onClick={(e) => e.stopPropagation()}
                      onSubmit={(e) => e.stopPropagation()}
                    >
                      <input type="hidden" name="delivery_id" value={r.id} />
                      <ApproveButton className={btnPrimary as any}>Akceptuj</ApproveButton>
                    </form>
                  )}

                  <span className={cls(btnDetails, "px-3")}>Szczegóły →</span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {filtersOpen && (
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/60" onClick={() => setFiltersOpen(false)} />

          <div
            className={cls(
              "absolute top-0 right-0 h-full w-[min(420px,100%)]",
              "bg-card border-l border-border shadow-2xl",
              "overflow-y-auto",
              "translate-x-0 animate-[deliveriesFilterSlideIn_.18s_ease-out]"
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
                    placeholder="osoba / lokalizacja / plac / dostawca / ID…"
                    className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                    autoFocus
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
                  <span className="text-xs opacity-70">Osoba</span>
                  <input
                    value={person}
                    onChange={(e) => setPerson(e.target.value)}
                    placeholder="np. Kowalski"
                    className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-xs opacity-70">Lokalizacja</span>
                  <input
                    value={inventoryLocation}
                    onChange={(e) => setInventoryLocation(e.target.value)}
                    placeholder="np. Magazyn A"
                    className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-xs opacity-70">Status</span>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as StatusFilter)}
                    className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  >
                    <option value="all">Wszystkie</option>
                    <option value="pending">Oczekujące</option>
                    <option value="approved">Zatwierdzone</option>
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
            @keyframes deliveriesFilterSlideIn_ {
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

export default function Page() {
  return (
    <RoleGuard allow={PERM.REPORTS_DELIVERIES_READ} silent>
      <DeliveriesReportInner />
    </RoleGuard>
  );
}