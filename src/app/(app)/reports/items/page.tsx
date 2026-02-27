// src/app/(app)/reports/items/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import RoleGuard from "@/components/RoleGuard";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { PERM } from "@/lib/permissions";

import ItemsReportFilters from "@/app/(app)/reports/items/_components/ItemsReportFilters";

type Status = "active" | "deleted" | "all";
type Stock = "in" | "all";

type Row = {
  id: string;
  title: string;
  unit: string | null;
  current_quantity: number | null;
  base_quantity: number | null;
  deleted_at: string | null;

  inventory_location_id?: string | null;
  inventory_location_label?: string | null;
};

/* ---------------------------------- UI HELPERS --------------------------------- */

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
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

function isLikelyId(s: string) {
  return /^[0-9a-f-]{8,}$/i.test(s);
}

function fmtQty(n: number | null) {
  if (n === null || n === undefined) return "—";
  const nf = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 3 });
  return nf.format(n);
}

function stockPct(current: number | null, base: number | null) {
  const c = typeof current === "number" ? current : 0;
  const b = typeof base === "number" ? base : 0;
  if (!b || b <= 0) return null;
  const pct = (c / b) * 100;
  if (!Number.isFinite(pct)) return null;
  return Math.max(0, Math.min(999, pct));
}

function statusTone(r: Row): "ok" | "bad" {
  return r.deleted_at ? "bad" : "ok";
}

function statusText(r: Row): string {
  return r.deleted_at ? "Usunięty" : "Aktywny";
}

/* ---------------------------------- DATA --------------------------------- */

async function fetchRows(params: {
  q?: string;
  status?: Status;
  stock?: Stock;
  loc?: string;
}): Promise<{ rows: Row[]; error: string | null }> {
  const supabase = supabaseBrowser();

  const selectWithLoc =
    "id,title,unit,current_quantity,base_quantity,deleted_at,inventory_location_id,inventory_location:inventory_locations(label)";

  const selectBare = "id,title,unit,current_quantity,base_quantity,deleted_at,inventory_location_id";

  async function runSelect(selectStr: string) {
    let q = supabase.from("materials").select(selectStr).order("title", { ascending: true }).limit(500);

    const s = (params.q ?? "").trim();
    if (s) {
      if (isLikelyId(s)) q = q.eq("id", s);
      else q = q.ilike("title", `%${s}%`);
    }

    const st = params.status ?? "active";
    if (st === "active") q = q.is("deleted_at", null);
    if (st === "deleted") q = q.not("deleted_at", "is", null);

    const stock = params.stock ?? "all";
    if (stock === "in") q = q.gt("current_quantity", 0);

    const { data, error } = (await q) as { data: any[] | null; error: any };
    if (error) return { data: null as any, error };
    return { data: data ?? [], error: null as any };
  }

  const try1 = await runSelect(selectWithLoc);
  if (!try1.error) {
    const rows: Row[] = (try1.data ?? []).map((r: any) => ({
      id: String(r.id),
      title: String(r.title ?? ""),
      unit: r.unit ?? null,
      current_quantity: r.current_quantity ?? null,
      base_quantity: r.base_quantity ?? null,
      deleted_at: r.deleted_at ?? null,
      inventory_location_id: r.inventory_location_id ?? null,
      inventory_location_label: r.inventory_location?.label ?? null,
    }));

    const loc = (params.loc ?? "").trim().toLowerCase();
    const filtered = loc
      ? rows.filter((x) => String(x.inventory_location_label ?? "").toLowerCase().includes(loc))
      : rows;

    return { rows: filtered, error: null };
  }

  const try2 = await runSelect(selectBare);
  if (try2.error) {
    console.error("reports/items fetch error:", try2.error);
    return { rows: [], error: try2.error.message ?? String(try2.error) };
  }

  const rows: Row[] = (try2.data ?? []).map((r: any) => ({
    id: String(r.id),
    title: String(r.title ?? ""),
    unit: r.unit ?? null,
    current_quantity: r.current_quantity ?? null,
    base_quantity: r.base_quantity ?? null,
    deleted_at: r.deleted_at ?? null,
    inventory_location_id: r.inventory_location_id ?? null,
    inventory_location_label: null,
  }));

  return { rows, error: null };
}

/* ---------------------------------- VIEW --------------------------------- */

function ItemsReportInner() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  // source of truth: URL
  const params = useMemo(() => {
    const q = sp.get("q") ?? "";
    const loc = sp.get("loc") ?? "";

    const stRaw = (sp.get("status") ?? "active") as Status;
    const status: Status =
      stRaw === "active" || stRaw === "deleted" || stRaw === "all" ? stRaw : "active";

    const stockRaw = (sp.get("stock") ?? "all") as Stock;
    const stock: Stock = stockRaw === "all" || stockRaw === "in" ? stockRaw : "all";

    return { q, loc, status, stock };
  }, [sp]);

  const [rows, setRows] = useState<Row[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [filtersOpen, setFiltersOpen] = useState(false);

  // mobile: szybkie szukanie w topbar (steruje URL param q)
  const [qTop, setQTop] = useState(params.q);
  useEffect(() => setQTop(params.q), [params.q]);

  // UX: ESC zamyka drawer
  useEffect(() => {
    if (!filtersOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFiltersOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtersOpen]);

  // UX: blokada scrolla tła gdy drawer otwarty
  useEffect(() => {
    if (!filtersOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [filtersOpen]);

  const debounceTopRef = useRef<number | null>(null);
  useEffect(() => {
    if (debounceTopRef.current) window.clearTimeout(debounceTopRef.current);

    debounceTopRef.current = window.setTimeout(() => {
      const next = new URLSearchParams(sp.toString());
      const t = qTop.trim();
      if (t) next.set("q", t);
      else next.delete("q");

      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, 250);

    return () => {
      if (debounceTopRef.current) window.clearTimeout(debounceTopRef.current);
    };
  }, [qTop, router, pathname, sp]);

  // fetch gdy URL się zmieni
  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await fetchRows(params);
      setRows(res.rows);
      setLoadError(res.error);
      setLoading(false);
    })();
  }, [params.q, params.loc, params.status, params.stock]);

  const countActive = useMemo(() => rows.filter((r) => !r.deleted_at).length, [rows]);
  const countDeleted = useMemo(() => rows.filter((r) => !!r.deleted_at).length, [rows]);

  // kanon buttonów (jak deliveries/daily)
  const btnBase =
    "inline-flex items-center justify-center h-9 px-3 rounded-lg border text-sm transition " +
    "focus:outline-none focus:ring-2 focus:ring-foreground/30 disabled:opacity-50 disabled:pointer-events-none";

  const btnGhost = cls(btnBase, "border-border bg-background/20 hover:bg-background/35");
  const btnPrimary = cls(
    btnBase,
    "border-emerald-500/35 bg-emerald-600/15 text-emerald-200 hover:bg-emerald-600/22"
  );
  const btnDetails = cls(
    btnBase,
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/14"
  );

  const clearAllUrl = () => {
    router.replace(pathname, { scroll: false });
    setQTop("");
  };

  return (
    <main className="space-y-4">
      {/* HEADER */}
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-base font-semibold leading-tight">Materiały</h1>
          <p className="text-xs opacity-70 mt-1">
            Lista materiałów (max 500). Filtry działają na żywo — kliknij w pozycję, aby wejść w
            szczegóły.
          </p>
        </div>

        <div className="hidden md:grid grid-cols-3 gap-2">
          <Kpi label="Wynik" value={loading ? "…" : rows.length} />
          <Kpi label="Aktywne" value={countActive} tone="ok" />
          <Kpi label="Usunięte" value={countDeleted} tone="bad" />
        </div>
      </header>

      <section className="rounded-2xl border border-border bg-card overflow-hidden">
        {/* TOP BAR */}
        <div className="p-3 md:p-4 border-b border-border bg-background/10">
          <div className="flex items-center gap-2">
            {/* search (mobile + desktop wspólny) */}
            <div className="flex-1 min-w-0">
              <input
                value={qTop}
                onChange={(e) => setQTop(e.target.value)}
                placeholder="Szukaj: nazwa / ID…"
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
            <span>{loading ? "Ładuję…" : `Wyników: ${rows.length} (max 500)`}</span>
            <span className="hidden md:inline">
              Aktywne: {countActive} • Usunięte: {countDeleted}
            </span>
          </div>
        </div>

        {/* DESKTOP FILTERS */}
        <div className="hidden md:block p-3 md:p-4 border-b border-border bg-background/5">
          <ItemsReportFilters q={params.q} loc={params.loc} status={params.status} stock={params.stock} />
        </div>

        {/* LIST */}
        <div className="p-3 md:p-4 space-y-3">
          {loadError && (
            <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
              Błąd ładowania materiałów: {loadError}
            </div>
          )}

          {!loadError && rows.length === 0 && !loading && (
            <div className="rounded-2xl border border-border bg-background/20 p-4 text-sm opacity-70">
              Brak wyników — zmień filtry.
            </div>
          )}

          {rows.map((r) => {
            const pct = stockPct(r.current_quantity, r.base_quantity);
            const low = pct !== null && pct <= 25;

            const locLabel = r.inventory_location_label || "—";
            const href = `/materials/${r.id}`;

            const qtyNow = fmtQty(r.current_quantity);
            const qtyBase = fmtQty(r.base_quantity);
            const pctText = pct === null ? "—" : `${Math.round(pct)}%`;

            return (
              <Link
                key={r.id}
                href={href}
                className={cls(
                  "block rounded-2xl border border-border bg-background/10 p-4 transition",
                  "hover:bg-background/18 hover:border-border/90",
                  "focus:outline-none focus:ring-2 focus:ring-foreground/30"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  {/* LEFT */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[11px] uppercase tracking-wide opacity-60">
                          Lokalizacja magazynowa
                        </div>
                        <div className="text-sm font-semibold truncate">{locLabel}</div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        <Pill tone={statusTone(r)}>{statusText(r)}</Pill>
                        {r.unit ? (
                          <span className="text-[11px] px-2 py-1 rounded border border-border bg-background/30 opacity-90">
                            {r.unit}
                          </span>
                        ) : null}
                        <span className="text-[10px] opacity-60 font-mono">#{String(r.id).slice(0, 8)}</span>
                      </div>
                    </div>

                    <div className="mt-2">
                      <div className="text-base font-semibold leading-tight truncate">{r.title}</div>

                      <div className="mt-2 grid gap-1 text-xs opacity-80">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="opacity-60">Aktualnie:</span>
                          <span className="font-medium opacity-100">{qtyNow}</span>
                          <span className="opacity-50">•</span>
                          <span className="opacity-60">Bazowo:</span>
                          <span className="font-medium opacity-100">{qtyBase}</span>
                          <span className="opacity-50">•</span>
                          <span className="opacity-60">Zapasy:</span>
                          <span className="font-medium opacity-100">{pctText}</span>
                        </div>
                      </div>
                    </div>

                    {pct !== null ? (
                      <div className="pt-3">
                        <div className="h-2 w-full rounded-full bg-background/40 border border-border overflow-hidden">
                          <div
                            className={cls("h-full", low ? "bg-red-500/80" : "bg-foreground/80")}
                            style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
                          />
                        </div>
                        <div className="text-[11px] opacity-60 pt-1">{low ? "Niski stan (≤25%)" : "OK"}</div>
                      </div>
                    ) : null}
                  </div>

                  {/* RIGHT (desktop only action) */}
                  <div className="hidden md:flex items-center gap-2 shrink-0">
                    <span className={cls(btnDetails, "px-3")}>Szczegóły →</span>
                  </div>
                </div>

                {/* MOBILE ACTION */}
                <div className="mt-4 md:hidden flex items-center justify-end">
                  <span className={cls(btnDetails, "px-3")}>Szczegóły →</span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* MOBILE: DRAWER FILTRÓW */}
      {filtersOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setFiltersOpen(false)} />

          <div
            className={cls(
              "absolute top-0 right-0 h-full w-[min(420px,100%)]",
              "bg-card border-l border-border shadow-2xl",
              "overflow-y-auto",
              "translate-x-0 animate-[itemsFilterSlideIn_.18s_ease-out]"
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
              <div className="[&_input]:h-11 [&_select]:h-11 [&_button]:h-11">
                <ItemsReportFilters
                  q={params.q}
                  loc={params.loc}
                  status={params.status}
                  stock={params.stock}
                />
              </div>

              <div className="text-xs opacity-60">
                Filtry działają na żywo. „Zastosuj” tylko zamyka panel.
              </div>
            </div>

            <div className="p-4 border-t border-border bg-background/10 flex items-center justify-between gap-2">
              <button type="button" className={btnGhost} onClick={clearAllUrl}>
                Wyczyść
              </button>

              <button type="button" className={btnPrimary} onClick={() => setFiltersOpen(false)}>
                Zastosuj
              </button>
            </div>
          </div>

          <style jsx>{`
            @keyframes itemsFilterSlideIn_ {
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
    <RoleGuard allow={PERM.REPORTS_ITEMS_READ} silent>
      <ItemsReportInner />
    </RoleGuard>
  );
}