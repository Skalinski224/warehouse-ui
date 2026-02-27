// src/app/(app)/summary/_components/SummaryTrendTabs.tsx
"use client";

import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

import type { PvrSeriesPoint } from "@/lib/queries/pvrSeries";
import type {
  MaterialPricingRollupSpendRow,
  DeliveryRangeRow,
  MaterialPricingRollupRow,
  MaterialPricingByLocationRow,
} from "@/lib/dto/pvr";
import type { StockValuePoint } from "@/lib/queries/stockValueSeries";
import type { InventoryShrinkPoint } from "@/lib/queries/inventoryShrinkSeries";

import PricingRollupSpendRangeTable from "@/app/(app)/summary/_components/PricingRollupSpendRangeTable";
import DeliveriesRangeTable from "@/app/(app)/summary/_components/DeliveriesRangeTable";
import PricingRollupTable from "@/app/(app)/summary/_components/PricingRollupTable";
import PricingByLocationTable from "@/app/(app)/summary/_components/PricingByLocationTable";
import InventoryAuditAccordion from "@/app/(app)/summary/_components/InventoryAuditAccordion";

type TabKey = "purchases" | "deliveries";
type ChartMode = "line" | "bar";
type PanelKey = "stock" | "shrink";
type HelpKey = "purchases" | "deliveries" | "stock" | "shrink";
type IntervalKey = "day" | "week" | "month";

type MobileTile = "purchases" | "deliveries" | "stock" | "shrink";

function money(n: number): string {
  return new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 2 }).format(n);
}

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function parseISODate(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s + "T00:00:00");
  return Number.isFinite(d.getTime()) ? d : null;
}

function startOfISOWeek(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay(); // 0=nd,1=pn
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthKeyFromISO(iso: string): string {
  return iso.slice(0, 7); // YYYY-MM
}

function weekKeyFromISO(iso: string): string {
  const d = parseISODate(iso);
  if (!d) return "";
  return toISODate(startOfISOWeek(d)); // bucket tygodnia jako YYYY-MM-DD (poniedziałek)
}

function listMonthsBetween(fromISO: string, toISO: string): string[] {
  const from = parseISODate(fromISO);
  const to = parseISODate(toISO);
  if (!from || !to) return [];
  const a = new Date(from.getFullYear(), from.getMonth(), 1);
  const b = new Date(to.getFullYear(), to.getMonth(), 1);

  const out: string[] = [];
  let cur = new Date(a);
  while (cur.getTime() <= b.getTime()) {
    out.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`);
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }
  return out;
}

function listWeeksBetween(fromISO: string, toISO: string): string[] {
  const from = parseISODate(fromISO);
  const to = parseISODate(toISO);
  if (!from || !to) return [];

  let cur = startOfISOWeek(from);
  const end = startOfISOWeek(to);

  const out: string[] = [];
  while (cur.getTime() <= end.getTime()) {
    out.push(toISODate(cur));
    cur = new Date(cur.getTime() + 7 * 86400000);
  }
  return out;
}

function listDaysBetween(fromISO: string, toISO: string): string[] {
  const from = parseISODate(fromISO);
  const to = parseISODate(toISO);
  if (!from || !to) return [];
  const a = new Date(from);
  const b = new Date(to);
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);

  const out: string[] = [];
  let cur = new Date(a);
  while (cur.getTime() <= b.getTime()) {
    out.push(toISODate(cur));
    cur = new Date(cur.getTime() + 86400000);
  }
  return out;
}

function yDomainWithHeadroom(
  values: Array<number | null | undefined>,
  headroomFrac = 0.25
): [number, number] {
  let max = 0;
  for (const v of values) {
    if (typeof v === "number" && Number.isFinite(v)) {
      if (v > max) max = v;
    }
  }
  if (max <= 0) return [0, 1];
  return [0, max * (1 + headroomFrac)];
}

function SegButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={cls(
        "rounded-lg border px-3 py-2 text-xs font-medium transition",
        !active && "border-border bg-background text-foreground hover:bg-muted/30",
        active &&
          "border-emerald-500/50 bg-emerald-500/15 text-foreground ring-1 ring-emerald-500/30"
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function HelpIconButton({
  isOpen,
  onClick,
}: {
  isOpen: boolean;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      aria-label="Pomoc"
      className={cls(
        "grid h-7 w-7 place-items-center rounded-full border text-xs font-semibold transition",
        "border-border bg-background/60 text-foreground hover:bg-muted/40",
        isOpen && "ring-1 ring-emerald-500/35 border-emerald-500/40 bg-emerald-500/10"
      )}
      onClick={onClick}
    >
      ?
    </button>
  );
}

/**
 * ✅ Popover zawsze w ekranie:
 * - mobile: fixed + marginesy, max szerokość = viewport
 * - md+: jak było (side right/left obok kafelka)
 */
function HelpPopover({
  open,
  title,
  body,
  onClose,
  side = "right",
}: {
  open: boolean;
  title: string;
  body: string;
  onClose: () => void;
  side?: "right" | "left";
}) {
  if (!open) return null;

  return (
    <div
      className={cls(
        "z-50 rounded-xl border border-border bg-card p-3 shadow-sm",
        // ✅ MOBILE: zawsze w ekranie
        "fixed left-3 right-3 top-24 max-h-[70vh] overflow-auto md:overflow-visible",
        // ✅ DESKTOP: jak było (pozycjonowanie przy kafelku)
        "md:absolute md:w-[19rem] md:left-0 md:right-auto md:top-[calc(100%+10px)] md:max-h-none",
        side === "right" && "md:left-[calc(100%+10px)] md:top-0",
        side === "left" && "md:left-auto md:right-[calc(100%+10px)] md:top-0"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-semibold">{title}</div>
        <button
          type="button"
          aria-label="Zamknij"
          className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted/30"
          onClick={onClose}
        >
          Zamknij
        </button>
      </div>
      <div className="mt-2 whitespace-pre-line text-xs leading-5 text-muted-foreground">
        {body}
      </div>
    </div>
  );
}

function StatCard({
  active,
  title,
  value,
  subtitle,
  helpKey,
  helpOpen,
  onHelpToggle,
  onSelect,
  helpSide = "right",
}: {
  active: boolean;
  title: string;
  value: string;
  subtitle: React.ReactNode;
  helpKey: HelpKey;
  helpOpen: HelpKey | null;
  onHelpToggle: (k: HelpKey) => void;
  onSelect: () => void;
  helpSide?: "right" | "left";
}) {
  const open = helpOpen === helpKey;

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect();
    }
  }

  return (
    <div className="relative">
      <div
        role="button"
        tabIndex={0}
        className={cls(
          "card relative cursor-pointer select-none p-4 text-left transition hover:bg-muted/30",
          active && "ring-1 ring-emerald-500/30 border-emerald-500/30 bg-emerald-500/10"
        )}
        onClick={onSelect}
        onKeyDown={onKeyDown}
      >
        <div className="absolute right-3 top-3">
          <HelpIconButton
            isOpen={open}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onHelpToggle(helpKey);
            }}
          />
        </div>

        <div className="text-sm text-muted-foreground">{title}</div>
        <div className="mt-1 text-2xl font-semibold">{value}</div>
        <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div>
      </div>

      <HelpPopover
        open={open}
        title={HELP[helpKey].title}
        body={HELP[helpKey].body}
        onClose={() => onHelpToggle(helpKey)}
        side={helpSide}
      />
    </div>
  );
}

/** ✅ WYKRESY: jaśniejsze i bardziej "premium" (dla dark mode) */
const GRID_STROKE = "oklch(var(--border)/0.55)";
const AXIS_STROKE = "oklch(var(--border)/0.70)";
const TICK_FILL = "oklch(var(--foreground)/0.90)";

const LINE_STROKE = "oklch(var(--foreground)/0.75)";
const BAR_FILL = "oklch(var(--foreground)/0.55)";
const BAR_STROKE = "oklch(var(--foreground)/0.75)";

const HELP: Record<HelpKey, { title: string; body: string }> = {
  purchases: {
    title: "Wydatki na materiały",
    body:
      "Pokazuje, ile faktycznie wydałeś na zakup materiałów w wybranym okresie.\n" +
      "System bierze wyłącznie zatwierdzone dostawy i sumuje każdą pozycję jako ilość × cena jednostkowa.\n" +
      "Jeśli wybierzesz konkretną lokalizację, dane dotyczą tylko jej – w przeciwnym razie widzisz wynik globalny.\n\n" +
      "Dzięki temu dokładnie wiesz, ile kosztował Cię materiał w danym czasie i możesz porównywać okresy, budowy lub lokalizacje.",
  },
  deliveries: {
    title: "Koszty dostawy",
    body:
      "To suma kosztów transportu wpisanych w zatwierdzonych dostawach z wybranego zakresu dat.\n" +
      "Wartość materiału nie jest tu uwzględniana – pokazujemy wyłącznie logistykę.\n" +
      "Dane liczone są osobno dla każdej lokalizacji lub łącznie dla całej firmy.\n\n" +
      "Pozwala to kontrolować, ile realnie kosztuje dowożenie materiału i czy sposób zamawiania jest efektywny.",
  },
  stock: {
    title: "Wartość inwentarza",
    body:
      "To szacunkowa wartość tego, co aktualnie znajduje się w magazynie.\n" +
      "Każdy materiał wyceniany jest według średniej ceny zakupu (WAC – Weighted Average Cost), liczonej na podstawie Twoich wcześniejszych dostaw.\n" +
      "Jeśli patrzysz globalnie – używany jest globalny WAC (średnia ze wszystkich lokalizacji).\n" +
      "Jeśli wybierzesz konkretną lokalizację – używany jest lokalny WAC, liczony tylko z jej dostaw.\n" +
      "Dlatego suma wartości z poszczególnych lokalizacji może różnić się od wartości globalnej – ponieważ średnie ceny mogą być inne w każdej lokalizacji.\n\n" +
      "Dzięki temu wiesz, ile pieniędzy masz obecnie „zamrożone” w zapasie i możesz podejmować świadome decyzje zakupowe.",
  },
  shrink: {
    title: "Inwentaryzacja (straty na materiale)",
    body:
      "Pokazuje różnicę między stanem systemowym a stanem fizycznie policzonym podczas zatwierdzonej inwentaryzacji.\n" +
      "Jeśli materiału brakuje – traktowane jest to jako strata.\n" +
      "Jeśli jest go więcej – różnica pomniejsza straty.\n" +
      "Wycena odbywa się według tej samej średniej ceny (WAC) – lokalnej lub globalnej, zależnie od wybranego widoku.\n\n" +
      "To pozwala zobaczyć realne ubytki w przeliczeniu na pieniądze i szybciej wykryć nieprawidłowości w obiegu materiału.",
  },
};

function intervalLabel(k: IntervalKey) {
  if (k === "day") return "Dzień";
  if (k === "week") return "Tydzień";
  return "Miesiąc";
}

export default function SummaryTrendTabs(props: {
  from: string;
  to: string;

  loc: string | null;

  purchasesTotalValue: number;
  purchasesTotalQty: number;

  deliveryCostTotalValue: number;
  deliveriesCount: number;

  stockValueNow: number;
  shrinkValue: number;
  shrinkQty: number;

  purchasesSeries: PvrSeriesPoint[];
  deliveryCostSeries: PvrSeriesPoint[];

  stockValueSeries: StockValuePoint[];
  inventoryShrinkSeries: InventoryShrinkPoint[];

  pricingRollupRows: MaterialPricingRollupRow[];
  pricingByLocationRows: MaterialPricingByLocationRow[];

  inventoryAudit: any;

  rollupSpendRangeRows: MaterialPricingRollupSpendRow[];
  deliveriesRangeRows: DeliveryRangeRow[];
}) {
  // ✅ Desktop: zostaje prawie jak było (tab + panel)
  // ✅ Mobile: jedna aktywna sekcja (kafelek) -> jeden wykres + jedna lista
  const [tab, setTab] = useState<TabKey>("purchases");
  const [mode, setMode] = useState<ChartMode>("line");
  const [panel, setPanel] = useState<PanelKey>("stock");
  const [helpOpen, setHelpOpen] = useState<HelpKey | null>(null);
  const [interval, setInterval] = useState<IntervalKey>("week");

  // ✅ MOBILE selector (domyślnie wydatki)
  const [mobileTile, setMobileTile] = useState<MobileTile>("purchases");

  const seriesLeftRaw = tab === "purchases" ? props.purchasesSeries : props.deliveryCostSeries;
  const chartModeLeft: ChartMode = tab === "deliveries" ? "bar" : mode;
  const chartTitleLeft = tab === "purchases" ? "Wydatki na materiały" : "Koszty dostawy";

  const chartDataLeft = useMemo(() => {
    const m = new Map<string, { value: number; count: number }>();

    for (const p of seriesLeftRaw) {
      const day = String(p.bucket ?? "").slice(0, 10);
      if (!day) continue;

      const k =
        interval === "day" ? day : interval === "week" ? weekKeyFromISO(day) : monthKeyFromISO(day);

      if (!k) continue;

      const prev = m.get(k) ?? { value: 0, count: 0 };
      prev.value += typeof p.value === "number" ? p.value : 0;
      prev.count += typeof p.count === "number" ? p.count : 0;
      m.set(k, prev);
    }

    const buckets =
      interval === "day"
        ? listDaysBetween(props.from, props.to)
        : interval === "week"
          ? listWeeksBetween(props.from, props.to)
          : listMonthsBetween(props.from, props.to);

    return buckets.map((bucket) => ({
      bucket,
      value: m.has(bucket) ? m.get(bucket)!.value : null,
      count: m.has(bucket) ? m.get(bucket)!.count : null,
    }));
  }, [seriesLeftRaw, interval, props.from, props.to]);

  const yDomainLeft = useMemo(() => {
    return yDomainWithHeadroom(chartDataLeft.map((x) => x.value ?? null), 0.25);
  }, [chartDataLeft]);

  const stockDaily = useMemo(() => {
    return props.stockValueSeries
      .map((p) => ({
        bucket: String(p.bucket ?? "").slice(0, 10),
        value: typeof p.stock_value_est === "number" ? p.stock_value_est : null,
      }))
      .filter((x) => x.bucket);
  }, [props.stockValueSeries]);

  const stockMaxWeeklyFilled = useMemo(() => {
    const maxMap = new Map<string, number>();
    for (const p of props.stockValueSeries) {
      const day = String(p.bucket ?? "").slice(0, 10);
      if (!day) continue;
      const k = weekKeyFromISO(day);
      if (!k) continue;
      const v = typeof p.stock_value_est === "number" ? p.stock_value_est : null;
      if (v === null) continue;
      const prev = maxMap.get(k);
      if (prev === undefined || v > prev) maxMap.set(k, v);
    }

    const buckets = listWeeksBetween(props.from, props.to);
    return buckets.map((bucket) => ({
      bucket,
      value: maxMap.has(bucket) ? maxMap.get(bucket)! : null,
    }));
  }, [props.stockValueSeries, props.from, props.to]);

  const stockMaxMonthlyFilled = useMemo(() => {
    const maxMap = new Map<string, number>();
    for (const p of props.stockValueSeries) {
      const day = String(p.bucket ?? "").slice(0, 10);
      if (!day) continue;
      const k = monthKeyFromISO(day);
      const v = typeof p.stock_value_est === "number" ? p.stock_value_est : null;
      if (v === null) continue;
      const prev = maxMap.get(k);
      if (prev === undefined || v > prev) maxMap.set(k, v);
    }

    const buckets = listMonthsBetween(props.from, props.to);
    return buckets.map((bucket) => ({
      bucket,
      value: maxMap.has(bucket) ? maxMap.get(bucket)! : null,
    }));
  }, [props.stockValueSeries, props.from, props.to]);

  const stockChartTitle =
    interval === "day"
      ? "Wartość inwentarza"
      : interval === "week"
        ? "Wartość inwentarza — max tygodnia"
        : "Wartość inwentarza — max miesiąca";

  const stockChartData =
    interval === "day"
      ? stockDaily
      : interval === "week"
        ? stockMaxWeeklyFilled
        : stockMaxMonthlyFilled;

  const yDomainStock = useMemo(() => {
    return yDomainWithHeadroom(stockChartData.map((x) => x.value ?? null), 0.25);
  }, [stockChartData]);

  const shrinkAgg = useMemo(() => {
    const m = new Map<string, number>();

    for (const p of props.inventoryShrinkSeries) {
      const day = String(p.bucket ?? "").slice(0, 10);
      if (!day) continue;

      const k =
        interval === "day"
          ? day
          : interval === "week"
            ? weekKeyFromISO(day)
            : monthKeyFromISO(day);

      if (!k) continue;

      const raw = typeof p.shrink_value_est === "number" ? p.shrink_value_est : null;
      if (raw === null) continue;

      const val = Math.abs(raw);
      m.set(k, (m.get(k) ?? 0) + val);
    }

    const buckets =
      interval === "day"
        ? listDaysBetween(props.from, props.to)
        : interval === "week"
          ? listWeeksBetween(props.from, props.to)
          : listMonthsBetween(props.from, props.to);

    return buckets.map((bucket) => ({
      bucket,
      value: m.has(bucket) ? m.get(bucket)! : null,
    }));
  }, [props.inventoryShrinkSeries, interval, props.from, props.to]);

  const yDomainShrink = useMemo(() => {
    return yDomainWithHeadroom(shrinkAgg.map((x) => x.value ?? null), 0.25);
  }, [shrinkAgg]);

  const isLocationMode = !!props.loc;

  function toggleHelp(key: HelpKey) {
    setHelpOpen((prev) => (prev === key ? null : key));
  }

  function selectMobile(tile: MobileTile) {
    setMobileTile(tile);
    // spinamy to z istniejącą logiką (żeby desktop nadal działał spójnie)
    if (tile === "purchases") setTab("purchases");
    if (tile === "deliveries") setTab("deliveries");
    if (tile === "stock") setPanel("stock");
    if (tile === "shrink") setPanel("shrink");
  }

  const mobileIsLeft = mobileTile === "purchases" || mobileTile === "deliveries";

  return (
    <div className="space-y-3">
      {/* DESKTOP/TABLET: dwa wykresy jak było (md+) */}
      <div className="hidden md:grid gap-3 md:grid-cols-2">
        {/* LEWY */}
        <div className="card p-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-base font-semibold">{chartTitleLeft}</div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <SegButton active={interval === "day"} onClick={() => setInterval("day")}>
                {intervalLabel("day")}
              </SegButton>
              <SegButton active={interval === "week"} onClick={() => setInterval("week")}>
                {intervalLabel("week")}
              </SegButton>
              <SegButton active={interval === "month"} onClick={() => setInterval("month")}>
                {intervalLabel("month")}
              </SegButton>

              {tab === "purchases" ? (
                <>
                  <div className="mx-1 h-5 w-px bg-border/60" />
                  <SegButton active={chartModeLeft === "line"} onClick={() => setMode("line")}>
                    Linia
                  </SegButton>
                  <SegButton active={chartModeLeft === "bar"} onClick={() => setMode("bar")}>
                    Słupki
                  </SegButton>
                </>
              ) : null}
            </div>
          </div>

          <div className="mt-3 h-56">
            {chartDataLeft.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                Brak punktów czasowych dla tego zakresu.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                {chartModeLeft === "line" ? (
                  <LineChart data={chartDataLeft} margin={{ top: 18, right: 14, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke={GRID_STROKE} strokeDasharray="2 6" />
                    <XAxis
                      dataKey="bucket"
                      stroke={AXIS_STROKE}
                      tick={{ fill: TICK_FILL, fontSize: 12 }}
                    />
                    <YAxis
                      domain={yDomainLeft as any}
                      stroke={AXIS_STROKE}
                      tick={{ fill: TICK_FILL, fontSize: 12 }}
                      tickFormatter={(v) => money(Number(v))}
                    />
                    <Tooltip
                      formatter={(v: any) => `${money(Number(v))} zł`}
                      labelFormatter={(l) => `${l}`}
                      contentStyle={{
                        background: "oklch(var(--card)/0.98)",
                        border: "1px solid oklch(var(--border)/0.7)",
                        borderRadius: 12,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      dot={false}
                      stroke={LINE_STROKE}
                      strokeWidth={2.5}
                    />
                  </LineChart>
                ) : (
                  <BarChart data={chartDataLeft} margin={{ top: 18, right: 14, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke={GRID_STROKE} strokeDasharray="2 6" />
                    <XAxis
                      dataKey="bucket"
                      stroke={AXIS_STROKE}
                      tick={{ fill: TICK_FILL, fontSize: 12 }}
                    />
                    <YAxis
                      domain={yDomainLeft as any}
                      stroke={AXIS_STROKE}
                      tick={{ fill: TICK_FILL, fontSize: 12 }}
                      tickFormatter={(v) => money(Number(v))}
                    />
                    <Tooltip
                      formatter={(v: any) => `${money(Number(v))} zł`}
                      labelFormatter={(l) => `${l}`}
                      contentStyle={{
                        background: "oklch(var(--card)/0.98)",
                        border: "1px solid oklch(var(--border)/0.7)",
                        borderRadius: 12,
                      }}
                    />
                    <Bar
                      dataKey="value"
                      fill={BAR_FILL}
                      stroke={BAR_STROKE}
                      strokeWidth={1}
                      radius={[10, 10, 0, 0]}
                      fillOpacity={0.9}
                      barSize={18}
                    />
                  </BarChart>
                )}
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* PRAWY */}
        <div className="card p-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-base font-semibold">
                {panel === "stock" ? stockChartTitle : "Inwentaryzacja (straty na materiale)"}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <SegButton active={interval === "day"} onClick={() => setInterval("day")}>
                {intervalLabel("day")}
              </SegButton>
              <SegButton active={interval === "week"} onClick={() => setInterval("week")}>
                {intervalLabel("week")}
              </SegButton>
              <SegButton active={interval === "month"} onClick={() => setInterval("month")}>
                {intervalLabel("month")}
              </SegButton>
            </div>
          </div>

          <div className="mt-3 h-56">
            {panel === "stock" ? (
              stockChartData.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  Brak snapshotów dla tego zakresu.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stockChartData} margin={{ top: 18, right: 14, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke={GRID_STROKE} strokeDasharray="2 6" />
                    <XAxis
                      dataKey="bucket"
                      stroke={AXIS_STROKE}
                      tick={{ fill: TICK_FILL, fontSize: 12 }}
                    />
                    <YAxis
                      domain={yDomainStock as any}
                      stroke={AXIS_STROKE}
                      tick={{ fill: TICK_FILL, fontSize: 12 }}
                      tickFormatter={(v) => money(Number(v))}
                    />
                    <Tooltip
                      formatter={(v: any) =>
                        v === null || v === undefined ? "—" : `${money(Number(v))} zł`
                      }
                      labelFormatter={(l) => `${l}`}
                      contentStyle={{
                        background: "oklch(var(--card)/0.98)",
                        border: "1px solid oklch(var(--border)/0.7)",
                        borderRadius: 12,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      dot={false}
                      stroke={LINE_STROKE}
                      strokeWidth={2.5}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )
            ) : shrinkAgg.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                Brak danych o inwentaryzacjach w tym zakresie.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={shrinkAgg} margin={{ top: 18, right: 14, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={GRID_STROKE} strokeDasharray="2 6" />
                  <XAxis
                    dataKey="bucket"
                    stroke={AXIS_STROKE}
                    tick={{ fill: TICK_FILL, fontSize: 12 }}
                  />
                  <YAxis
                    domain={yDomainShrink as any}
                    stroke={AXIS_STROKE}
                    tick={{ fill: TICK_FILL, fontSize: 12 }}
                    tickFormatter={(v) => money(Number(v))}
                  />
                  <Tooltip
                    formatter={(v: any) =>
                      v === null || v === undefined ? "—" : `${money(Number(v))} zł`
                    }
                    labelFormatter={(l) => `${l}`}
                    contentStyle={{
                      background: "oklch(var(--card)/0.98)",
                      border: "1px solid oklch(var(--border)/0.7)",
                      borderRadius: 12,
                    }}
                  />
                  <Bar
                    dataKey="value"
                    fill={BAR_FILL}
                    stroke={BAR_STROKE}
                    strokeWidth={1}
                    radius={[10, 10, 0, 0]}
                    fillOpacity={0.9}
                    barSize={18}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* ✅ DESKTOP/TABLET: kafelki POD wykresami, PRZED listami */}
      <div className="hidden md:grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          active={tab === "purchases"}
          title="Wydatki na materiały"
          value={`${money(props.purchasesTotalValue)} zł`}
          subtitle=""
          helpKey="purchases"
          helpOpen={helpOpen}
          onHelpToggle={toggleHelp}
          onSelect={() => setTab("purchases")}
        />

        <StatCard
          active={tab === "deliveries"}
          title="Koszty dostawy"
          value={`${money(props.deliveryCostTotalValue)} zł`}
          subtitle=""
          helpKey="deliveries"
          helpOpen={helpOpen}
          onHelpToggle={toggleHelp}
          onSelect={() => setTab("deliveries")}
        />

        <StatCard
          active={panel === "stock"}
          title="Wartość inwentarza"
          value={`${money(props.stockValueNow)} zł`}
          subtitle=""
          helpKey="stock"
          helpOpen={helpOpen}
          onHelpToggle={toggleHelp}
          onSelect={() => setPanel("stock")}
        />

        <StatCard
          active={panel === "shrink"}
          title="Inwentaryzacja (straty)"
          value={`${money(props.shrinkValue)} zł`}
          subtitle=""
          helpKey="shrink"
          helpOpen={helpOpen}
          onHelpToggle={toggleHelp}
          onSelect={() => setPanel("shrink")}
          helpSide="left"
        />
      </div>

      {/* MOBILE: dokładnie JEDEN wykres (zależny od kafelka) */}
      <div className="md:hidden">
        <div className="card p-4">
          <div className="flex flex-col gap-2">
            <div className="text-base font-semibold">
              {mobileTile === "purchases"
                ? "Wydatki na materiały"
                : mobileTile === "deliveries"
                  ? "Koszty dostawy"
                  : mobileTile === "stock"
                    ? stockChartTitle
                    : "Inwentaryzacja (straty na materiale)"}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <SegButton active={interval === "day"} onClick={() => setInterval("day")}>
                {intervalLabel("day")}
              </SegButton>
              <SegButton active={interval === "week"} onClick={() => setInterval("week")}>
                {intervalLabel("week")}
              </SegButton>
              <SegButton active={interval === "month"} onClick={() => setInterval("month")}>
                {intervalLabel("month")}
              </SegButton>

              {mobileTile === "purchases" ? (
                <>
                  <div className="mx-1 h-5 w-px bg-border/60" />
                  <SegButton active={mode === "line"} onClick={() => setMode("line")}>
                    Linia
                  </SegButton>
                  <SegButton active={mode === "bar"} onClick={() => setMode("bar")}>
                    Słupki
                  </SegButton>
                </>
              ) : null}
            </div>
          </div>

          <div className="mt-3 h-56">
            {mobileIsLeft ? (
              chartDataLeft.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  Brak punktów czasowych dla tego zakresu.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  {mobileTile === "deliveries" || (mobileTile === "purchases" && mode === "bar") ? (
                    <BarChart data={chartDataLeft} margin={{ top: 18, right: 14, bottom: 0, left: 0 }}>
                      <CartesianGrid stroke={GRID_STROKE} strokeDasharray="2 6" />
                      <XAxis
                        dataKey="bucket"
                        stroke={AXIS_STROKE}
                        tick={{ fill: TICK_FILL, fontSize: 12 }}
                      />
                      <YAxis
                        domain={yDomainLeft as any}
                        stroke={AXIS_STROKE}
                        tick={{ fill: TICK_FILL, fontSize: 12 }}
                        tickFormatter={(v) => money(Number(v))}
                      />
                      <Tooltip
                        formatter={(v: any) => `${money(Number(v))} zł`}
                        labelFormatter={(l) => `${l}`}
                        contentStyle={{
                          background: "oklch(var(--card)/0.98)",
                          border: "1px solid oklch(var(--border)/0.7)",
                          borderRadius: 12,
                        }}
                      />
                      <Bar
                        dataKey="value"
                        fill={BAR_FILL}
                        stroke={BAR_STROKE}
                        strokeWidth={1}
                        radius={[10, 10, 0, 0]}
                        fillOpacity={0.9}
                        barSize={18}
                      />
                    </BarChart>
                  ) : (
                    <LineChart data={chartDataLeft} margin={{ top: 18, right: 14, bottom: 0, left: 0 }}>
                      <CartesianGrid stroke={GRID_STROKE} strokeDasharray="2 6" />
                      <XAxis
                        dataKey="bucket"
                        stroke={AXIS_STROKE}
                        tick={{ fill: TICK_FILL, fontSize: 12 }}
                      />
                      <YAxis
                        domain={yDomainLeft as any}
                        stroke={AXIS_STROKE}
                        tick={{ fill: TICK_FILL, fontSize: 12 }}
                        tickFormatter={(v) => money(Number(v))}
                      />
                      <Tooltip
                        formatter={(v: any) => `${money(Number(v))} zł`}
                        labelFormatter={(l) => `${l}`}
                        contentStyle={{
                          background: "oklch(var(--card)/0.98)",
                          border: "1px solid oklch(var(--border)/0.7)",
                          borderRadius: 12,
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        dot={false}
                        stroke={LINE_STROKE}
                        strokeWidth={2.5}
                      />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              )
            ) : mobileTile === "stock" ? (
              stockChartData.length === 0 ? (
                <div className="text-sm text-muted-foreground">Brak snapshotów dla tego zakresu.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stockChartData} margin={{ top: 18, right: 14, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke={GRID_STROKE} strokeDasharray="2 6" />
                    <XAxis
                      dataKey="bucket"
                      stroke={AXIS_STROKE}
                      tick={{ fill: TICK_FILL, fontSize: 12 }}
                    />
                    <YAxis
                      domain={yDomainStock as any}
                      stroke={AXIS_STROKE}
                      tick={{ fill: TICK_FILL, fontSize: 12 }}
                      tickFormatter={(v) => money(Number(v))}
                    />
                    <Tooltip
                      formatter={(v: any) =>
                        v === null || v === undefined ? "—" : `${money(Number(v))} zł`
                      }
                      labelFormatter={(l) => `${l}`}
                      contentStyle={{
                        background: "oklch(var(--card)/0.98)",
                        border: "1px solid oklch(var(--border)/0.7)",
                        borderRadius: 12,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      dot={false}
                      stroke={LINE_STROKE}
                      strokeWidth={2.5}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )
            ) : shrinkAgg.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                Brak danych o inwentaryzacjach w tym zakresie.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={shrinkAgg} margin={{ top: 18, right: 14, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={GRID_STROKE} strokeDasharray="2 6" />
                  <XAxis
                    dataKey="bucket"
                    stroke={AXIS_STROKE}
                    tick={{ fill: TICK_FILL, fontSize: 12 }}
                  />
                  <YAxis
                    domain={yDomainShrink as any}
                    stroke={AXIS_STROKE}
                    tick={{ fill: TICK_FILL, fontSize: 12 }}
                    tickFormatter={(v) => money(Number(v))}
                  />
                  <Tooltip
                    formatter={(v: any) =>
                      v === null || v === undefined ? "—" : `${money(Number(v))} zł`
                    }
                    labelFormatter={(l) => `${l}`}
                    contentStyle={{
                      background: "oklch(var(--card)/0.98)",
                      border: "1px solid oklch(var(--border)/0.7)",
                      borderRadius: 12,
                    }}
                  />
                  <Bar
                    dataKey="value"
                    fill={BAR_FILL}
                    stroke={BAR_STROKE}
                    strokeWidth={1}
                    radius={[10, 10, 0, 0]}
                    fillOpacity={0.9}
                    barSize={18}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* ✅ MOBILE: kafelki POD wykresem, PRZED listą (2x2) */}
      <div className="md:hidden grid grid-cols-2 gap-3">
        <StatCard
          active={mobileTile === "purchases"}
          title="Wydatki"
          value={`${money(props.purchasesTotalValue)} zł`}
          subtitle="Kliknij"
          helpKey="purchases"
          helpOpen={helpOpen}
          onHelpToggle={toggleHelp}
          onSelect={() => selectMobile("purchases")}
        />

        <StatCard
          active={mobileTile === "deliveries"}
          title="Dostawy"
          value={`${money(props.deliveryCostTotalValue)} zł`}
          subtitle="Kliknij"
          helpKey="deliveries"
          helpOpen={helpOpen}
          onHelpToggle={toggleHelp}
          onSelect={() => selectMobile("deliveries")}
        />

        <StatCard
          active={mobileTile === "stock"}
          title="Inwentarz"
          value={`${money(props.stockValueNow)} zł`}
          subtitle="Kliknij"
          helpKey="stock"
          helpOpen={helpOpen}
          onHelpToggle={toggleHelp}
          onSelect={() => selectMobile("stock")}
        />

        <StatCard
          active={mobileTile === "shrink"}
          title="Straty"
          value={`${money(props.shrinkValue)} zł`}
          subtitle="Kliknij"
          helpKey="shrink"
          helpOpen={helpOpen}
          onHelpToggle={toggleHelp}
          onSelect={() => selectMobile("shrink")}
          helpSide="left"
        />
      </div>

      {/* DESKTOP: tabele jak było (xl grid 2 kolumny) */}
      <div className="hidden md:grid gap-3 xl:grid-cols-2">
        {tab === "purchases" ? (
          <PricingRollupSpendRangeTable
            rows={props.rollupSpendRangeRows}
            from={props.from}
            to={props.to}
          />
        ) : (
          <DeliveriesRangeTable
            rows={props.deliveriesRangeRows}
            from={props.from}
            to={props.to}
          />
        )}

        {panel === "stock" ? (
          isLocationMode ? (
            <PricingByLocationTable rows={props.pricingByLocationRows} title="Średnie ceny — lokacja" />
          ) : (
            <PricingRollupTable rows={props.pricingRollupRows} />
          )
        ) : (
          <div className="card p-4">
            <InventoryAuditAccordion data={props.inventoryAudit} />
          </div>
        )}
      </div>

      {/* MOBILE: dokładnie JEDNA lista (zależna od kafelka) */}
      <div className="md:hidden">
        {mobileTile === "purchases" ? (
          <PricingRollupSpendRangeTable rows={props.rollupSpendRangeRows} from={props.from} to={props.to} />
        ) : mobileTile === "deliveries" ? (
          <DeliveriesRangeTable rows={props.deliveriesRangeRows} from={props.from} to={props.to} />
        ) : mobileTile === "stock" ? (
          isLocationMode ? (
            <PricingByLocationTable rows={props.pricingByLocationRows} title="Średnie ceny — lokacja" />
          ) : (
            <PricingRollupTable rows={props.pricingRollupRows} />
          )
        ) : (
          <div className="card p-4">
            <InventoryAuditAccordion data={props.inventoryAudit} />
          </div>
        )}
      </div>

      {/* ✅ overlay dla mobile, kiedy popover jest otwarty (zamknięcie tapem poza) */}
      {helpOpen ? (
        <button
          type="button"
          aria-label="Zamknij pomoc"
          className="fixed inset-0 z-40 md:hidden"
          onClick={() => setHelpOpen(null)}
        />
      ) : null}
    </div>
  );
}