// src/app/(app)/reports/deliveries/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import ApproveButton from "@/components/ApproveButton";
import RoleGuard from "@/components/RoleGuard";
import BackButton from "@/components/BackButton";

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

  // PŁATNOŚĆ
  is_paid: boolean | null;
  payment_due_date: string | null;
  payment_status: string | null;
  days_to_due: number | string | null;
  is_overdue: boolean | null;

  items_count?: number | string | null;
};

type StatusFilter = "all" | "pending" | "approved";

/* ---------------------------------- UI HELPERS --------------------------------- */

function Tag({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "ok" | "warn" | "bad";
}) {
  const cls =
    tone === "ok"
      ? "border-emerald-500/40 bg-emerald-600/10 text-emerald-200"
      : tone === "warn"
      ? "border-amber-500/40 bg-amber-600/10 text-amber-200"
      : tone === "bad"
      ? "border-red-500/40 bg-red-600/10 text-red-200"
      : "border-border bg-background/40 text-foreground/80";

  return (
    <span className={`text-[10px] px-2 py-0.5 rounded border ${cls}`}>
      {children}
    </span>
  );
}

function KV({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Tag>{label}</Tag>
      <span className={strong ? "text-sm font-medium" : "text-sm"}>{value}</span>
    </div>
  );
}

function MiniKV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <span className="text-[11px] px-2 py-1 rounded bg-background/60 border border-border">
      <span className="opacity-70">{label}:</span>{" "}
      <span className="font-semibold">{value}</span>
    </span>
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

function toInt(v: number | string | null): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? Math.trunc(v) : null;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pl-PL");
}

function paymentLabel(r: Row): { text: string; tone: "neutral" | "ok" | "warn" | "bad" } {
  if (r.deleted_at) return { text: "usunięta", tone: "neutral" };
  if (r.is_paid) return { text: "opłacona", tone: "ok" };
  if (r.is_overdue) return { text: "po terminie", tone: "bad" };
  if (!r.payment_due_date) return { text: "nieopłacona (bez terminu)", tone: "warn" };
  return { text: "do zapłaty", tone: "warn" };
}

async function fetchRows(params: {
  from?: string;
  to?: string;
  person?: string;
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
      q = q.or(`person.ilike.%${s}%,place_label.ilike.%${s}%,supplier.ilike.%${s}%`);
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
  status: StatusFilter;
  q: string;
}) {
  const p = new URLSearchParams();
  if (params.from.trim()) p.set("from", params.from.trim());
  if (params.to.trim()) p.set("to", params.to.trim());
  if (params.person.trim()) p.set("person", params.person.trim());
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
  const [status, setStatus] = useState<StatusFilter>(initial.status);
  const [query, setQuery] = useState(initial.q);

  const [rows, setRows] = useState<Row[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const debounceRef = useRef<number | null>(null);
  const lastUrlRef = useRef<string>("");

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);

    debounceRef.current = window.setTimeout(async () => {
      const nextUrl = mkUrl({ from, to, person, status, q: query });
      if (lastUrlRef.current !== nextUrl) {
        lastUrlRef.current = nextUrl;
        router.replace(nextUrl, { scroll: false });
      }

      setLoading(true);
      const res = await fetchRows({ from, to, person, status, q: query });
      setRows(res.rows);
      setLoadError(res.error);
      setLoading(false);
    }, 250);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [from, to, person, status, query, router]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await fetchRows({ from, to, person, status, q: query });
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

  return (
    <main className="p-6 space-y-4">
      {/* HEADER (kanon) */}
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-sm font-medium">Raport: dostawy</h1>
          <p className="text-xs opacity-70">
            Zestawienie dostaw. Filtry działają na żywo. Kliknij w pozycję, żeby wejść
            w szczegóły.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <MiniKV label="Wynik" value={rows.length} />
          <MiniKV label="Zatw." value={countApproved} />
          <MiniKV label="Oczek." value={countPending} />
          <BackButton />
        </div>
      </header>

      {/* FILTRY (kanon) */}
      <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Filtry</div>
            <div className="text-xs opacity-70">
              Zakres dat, osoba, status, wyszukiwanie po ID / osobie / miejscu / dostawcy.
            </div>
          </div>

          <span className="text-[11px] px-2 py-1 rounded bg-background/60 border border-border">
            {loading ? "Ładuję…" : "Gotowe"}
          </span>
        </div>

        <div className="grid gap-3 md:grid-cols-6">
          <label className="grid gap-2">
            <span className="text-sm">Od</span>
            <input
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              type="date"
              className="h-10 w-full rounded border border-border bg-background px-3 text-sm"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm">Do</span>
            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              type="date"
              className="h-10 w-full rounded border border-border bg-background px-3 text-sm"
            />
          </label>

          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm">Osoba</span>
            <input
              value={person}
              onChange={(e) => setPerson(e.target.value)}
              placeholder="np. Kowalski"
              className="h-10 w-full rounded border border-border bg-background px-3 text-sm"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm">Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusFilter)}
              className="h-10 w-full rounded border border-border bg-background px-3 text-sm"
            >
              <option value="all">Wszystkie</option>
              <option value="pending">Oczekujące</option>
              <option value="approved">Zatwierdzone</option>
            </select>
          </label>

          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm">Szukaj</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ID / nazwisko / plac / dostawca…"
              className="h-10 w-full rounded border border-border bg-background px-3 text-sm"
            />
            <div className="text-[11px] opacity-70 min-h-[16px]">
              {query.trim() ? (
                <span>
                  Szukam: <span className="font-medium">„{query.trim()}”</span>
                </span>
              ) : (
                <span />
              )}
            </div>
          </label>
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="text-xs opacity-70">
            {loading ? "Ładuję…" : `Wyników: ${rows.length}`}
            <span className="hidden sm:inline"> • maks. 100 rekordów</span>
          </div>

          <button
            type="button"
            onClick={() => {
              setFrom("");
              setTo("");
              setPerson("");
              setStatus("all");
              setQuery("");
            }}
            className="px-3 py-2 rounded border border-border bg-card hover:bg-card/80 text-sm transition"
          >
            Wyczyść
          </button>
        </div>
      </section>

      {/* LISTA */}
      <section className="space-y-3">
        {loadError && (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
            Błąd ładowania dostaw: {loadError}
          </div>
        )}

        {!loadError && rows.length === 0 && !loading && (
          <div className="rounded-2xl border border-border bg-card p-4 text-sm opacity-70">
            Brak wyników – zmień filtry.
          </div>
        )}

        {rows.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="space-y-3">
              {rows.map((r) => {
                const itemsCount = toInt(r.items_count ?? null) ?? 0;

                const materialsCost = toNum(r.materials_cost ?? 0);
                const deliveryCost = toNum(r.delivery_cost ?? 0);
                const total = materialsCost + deliveryCost;

                const placeLabel = r.place_label || "—";
                const personLabel = r.person || "—";
                const supplierLabel = r.supplier || "—";

                const pay = paymentLabel(r);

                const due = r.payment_due_date ? fmtDate(r.payment_due_date) : "—";
                const days = toInt(r.days_to_due ?? null);

                const statusTone = r.approved ? "ok" : "warn";
                const statusText = r.approved ? "zatwierdzona" : "oczekująca";

                const href = `/reports/deliveries/${r.id}`;

                return (
                  <Link
                    key={r.id}
                    href={href}
                    className={[
                      "block rounded-2xl border border-border bg-background/20 p-4",
                      "hover:bg-background/35 hover:border-border/90 transition",
                      "focus:outline-none focus:ring-2 focus:ring-foreground/40",
                    ].join(" ")}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      {/* LEWA */}
                      <div className="min-w-0 space-y-2">
                        {/* ID + statusy */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <MiniKV label="ID" value={`#${r.id.slice(0, 8)}`} />
                          <span className="inline-flex items-center gap-2">
                            <Tag>STATUS</Tag>
                            <Tag tone={statusTone}>{statusText}</Tag>
                          </span>
                          <span className="inline-flex items-center gap-2">
                            <Tag>PŁATNOŚĆ</Tag>
                            <Tag tone={pay.tone}>{pay.text}</Tag>
                          </span>
                          <MiniKV label="POZYCJI" value={itemsCount} />
                        </div>

                        {/* KTO / KIEDY / MIEJSCE / DOSTAWCA */}
                        <div className="grid gap-2">
                          <KV label="MIEJSCE" value={placeLabel} strong />
                          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-6">
                            <KV label="KTO" value={personLabel} />
                            <KV label="KIEDY" value={fmtDate(r.date)} />
                            <KV label="DOSTAWCA" value={supplierLabel} />
                          </div>
                        </div>

                        {/* KOSZTY */}
                        <div className="pt-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Tag>KOSZTY</Tag>
                            <span className="text-[11px] opacity-80">
                              Materiały:{" "}
                              <span className="font-semibold">
                                {fmtCurrency.format(materialsCost)}
                              </span>
                            </span>
                            <span className="text-[11px] opacity-80">
                              Dostawa:{" "}
                              <span className="font-semibold">
                                {fmtCurrency.format(deliveryCost)}
                              </span>
                            </span>
                            <span className="text-[11px] opacity-80">
                              Razem:{" "}
                              <span className="font-semibold">
                                {fmtCurrency.format(total)}
                              </span>
                            </span>
                          </div>
                        </div>

                        {/* TERMIN */}
                        {!r.is_paid && (
                          <div className="pt-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Tag>TERMIN</Tag>
                              {r.payment_due_date ? (
                                <span className="text-[11px] opacity-80">
                                  Płatność do:{" "}
                                  <span className="font-semibold">{due}</span>
                                  {typeof days === "number" && (
                                    <span className="ml-1 opacity-70">
                                      {days < 0
                                        ? `(po terminie o ${Math.abs(days)} dni)`
                                        : days === 0
                                        ? "(termin dzisiaj)"
                                        : `(za ${days} dni)`}
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-[11px] opacity-70">
                                  Brak ustawionego terminu płatności.
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* PRAWA: akcje */}
                      <div className="flex items-center gap-2 text-sm flex-wrap justify-end">
                        {!r.is_paid && (
                          <form
                            action={markDeliveryPaid}
                            onClick={(e) => e.stopPropagation()}
                            onSubmit={(e) => e.stopPropagation()}
                          >
                            <input type="hidden" name="delivery_id" value={r.id} />
                            <button
                              type="submit"
                              className="px-3 py-2 rounded border border-emerald-500/60 bg-emerald-600/20 text-emerald-100 hover:bg-emerald-600/30 text-sm transition"
                            >
                              Oznacz jako opłaconą
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
                            <ApproveButton>Akceptuj (magazyn)</ApproveButton>
                          </form>
                        )}

                        <span className="px-3 py-2 rounded border border-border bg-card hover:bg-card/80 text-sm transition">
                          Szczegóły →
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </section>
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
