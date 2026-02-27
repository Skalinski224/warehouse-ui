// src/app/(app)/reports/transfers/[day]/[createdBy]/[fromLocationId]/[toLocationId]/page.tsx
import Link from "next/link";

import { getTransferReportItems } from "@/lib/queries/transferReports";
import { supabaseServer } from "@/lib/supabaseServer";

type Params = Promise<{
  day: string; // YYYY-MM-DD
  createdBy: string;
  fromLocationId: string;
  toLocationId: string;
}>;

/* ------------------------------------------------------------------ */
/* UI helpers (KANON)                                                  */
/* ------------------------------------------------------------------ */

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "ok" | "warn" | "bad" | "okSoft";
  className?: string;
}) {
  const cls =
    tone === "ok"
      ? "border-emerald-500/40 bg-emerald-600/10 text-emerald-200"
      : tone === "okSoft"
      ? "border-emerald-500/25 bg-emerald-600/15 text-emerald-100"
      : tone === "warn"
      ? "border-amber-500/40 bg-amber-600/10 text-amber-200"
      : tone === "bad"
      ? "border-red-500/40 bg-red-600/10 text-red-200"
      : "border-border bg-background/40 text-foreground/80";

  return (
    <span
      className={cx(
        "text-[11px] px-2 py-1 rounded-full border whitespace-nowrap leading-none",
        cls,
        className
      )}
    >
      {children}
    </span>
  );
}

function Field({
  label,
  value,
  strong,
}: {
  label: string;
  value: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground/90">
        {label}
      </div>
      <div className={cx("text-[15px] leading-snug", strong && "font-semibold")}>
        {value}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function fmtWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pl-PL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function n(v: any) {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

async function resolveLocationLabel(id: string): Promise<string | null> {
  try {
    const sb = await supabaseServer();
    const { data, error } = await sb
      .from("inventory_locations")
      .select("label")
      .eq("id", id)
      .maybeSingle();

    if (error) return null;
    const lbl = (data as any)?.label ?? null;
    return typeof lbl === "string" && lbl.trim() ? lbl.trim() : null;
  } catch {
    return null;
  }
}

// ✅ standard deep-link do materiału z kontekstem lokacji
function materialHref(materialId: string, locationId?: string | null) {
  const base = `/materials/${materialId}`;
  if (!locationId) return base;
  // jeśli u Ciebie inny parametr — zmień tylko "loc"
  return `${base}?loc=${encodeURIComponent(locationId)}`;
}

export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default async function TransferReportDetailsPage({ params }: { params: Params }) {
  const { day, createdBy, fromLocationId, toLocationId } = await params;

  const items = await getTransferReportItems({
    day,
    createdBy,
    fromLocationId,
    toLocationId,
  });

  const fromLabelFromItems = (items[0] as any)?.from_location_label ?? null;
  const toLabelFromItems = (items[0] as any)?.to_location_label ?? null;

  const [fromLabelDb, toLabelDb] = await Promise.all([
    fromLabelFromItems ? Promise.resolve(null) : resolveLocationLabel(fromLocationId),
    toLabelFromItems ? Promise.resolve(null) : resolveLocationLabel(toLocationId),
  ]);

  const fromLabel = (fromLabelFromItems ?? fromLabelDb ?? fromLocationId) as string;
  const toLabel = (toLabelFromItems ?? toLabelDb ?? toLocationId) as string;

  const transfersCount = items.length;
  const qtyTotal = items.reduce((acc, x) => acc + n((x as any).qty), 0);

  const lastAt = items.length ? (items[0] as any).created_at : null;
  const firstAt = items.length ? (items[items.length - 1] as any).created_at : null;

  const actorLabel =
    (items[0] as any)?.created_by_name?.trim?.() ||
    (items[0] as any)?.created_by_email?.trim?.() ||
    createdBy;

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-base font-semibold">Transfer</h1>
          <p className="text-xs opacity-70">
            Przeniesienie materiałów między lokalizacjami magazynowymi.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge className="px-3">
            {fromLabel} <span className="opacity-60">→</span> {toLabel}
          </Badge>
          <Badge className="px-3">DATA {day}</Badge>
        </div>
      </header>

      {/* META PANEL */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm font-medium">Podstawowe informacje</div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge tone="okSoft">{transfersCount} pozycji</Badge>
              <Badge tone="okSoft">{qtyTotal} łącznie</Badge>
              {firstAt && lastAt ? (
                <Badge tone="okSoft" className="hidden sm:inline-flex">
                  {fmtWhen(firstAt)} <span className="opacity-60 mx-1">→</span> {fmtWhen(lastAt)}
                </Badge>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Data" value={day} strong />
            <Field label="Osoba" value={actorLabel || "—"} strong />

            <Field label="Z (lokalizacja)" value={fromLabel} />
            <Field label="Do (lokalizacja)" value={toLabel} />

            <Field label="Liczba pozycji" value={transfersCount} />
            <Field label="Suma ilości" value={qtyTotal} />
          </div>
        </div>
      </section>

      {/* CONTENT */}
      {items.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-4 text-sm opacity-75">
          Brak pozycji w raporcie.
        </div>
      ) : (
        <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-sm font-medium">Pozycje transferu</h2>
              <div className="text-xs opacity-70">Pozycje: {transfersCount}</div>
            </div>
            <Badge tone="okSoft">{qtyTotal} łącznie</Badge>
          </div>

          <div className="space-y-2">
            {items.map((it: any, idx: number) => {
              const title = it.from_title ?? it.to_title ?? "—";
              const qty = n(it.qty);

              const when = it.created_at ? fmtWhen(it.created_at) : "—";
              const note = (it.note ?? "").trim();

              const fromBefore = it.from_qty_before;
              const fromAfter = it.from_qty_after;

              const toBefore = it.to_qty_before;
              const toAfter = it.to_qty_after;

              const materialId: string | null = it.material_id ?? null;

              const hrefMaterial = materialId ? `/materials/${materialId}` : null;
              const hrefFrom = materialId ? materialHref(materialId, fromLocationId) : null;
              const hrefTo = materialId ? materialHref(materialId, toLocationId) : null;

              return (
                <div
                  key={it.transfer_id ?? `${idx}`}
                  className="rounded-2xl border border-border bg-background/30 px-3 py-3"
                >
                  {/* HEADER ROW */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {hrefMaterial ? (
                        <Link
                          href={hrefMaterial}
                          className="text-[15px] font-semibold truncate underline underline-offset-2 hover:opacity-100 opacity-95"
                        >
                          {title}
                        </Link>
                      ) : (
                        <div className="text-[15px] font-semibold truncate">{title}</div>
                      )}

                      <div className="text-xs opacity-70 mt-0.5">
                        {when}
                        {note ? <span className="mx-2 opacity-40">•</span> : null}
                        {note ? <span className="opacity-90">{note}</span> : null}
                      </div>
                    </div>

                    {/* QTY (bigger on desktop) */}
                    <div className="shrink-0 text-right">
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground/90">
                        Ilość
                      </div>
                      <div className="text-[18px] sm:text-[20px] font-semibold leading-none">
                        {qty}
                      </div>
                    </div>
                  </div>

                  {/* TWO PANELS SIDE BY SIDE (always) */}
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {/* FROM */}
                    {hrefFrom ? (
                      <Link
                        href={hrefFrom}
                        className={cx(
                          "rounded-2xl border border-border bg-background/20 px-3 py-3",
                          "transition hover:bg-card/80 hover:border-border/80 active:scale-[0.995]"
                        )}
                        aria-label={`Zobacz materiał w lokacji: ${fromLabel}`}
                      >
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground/90 truncate">
                          {fromLabel}
                        </div>

                        <div className="mt-1 flex items-baseline justify-between gap-3">
                          <div className="text-[13px] sm:text-[14px] opacity-85">
                            <span className="opacity-80">{String(fromBefore ?? "—")}</span>
                            <span className="mx-2 opacity-40">→</span>
                            <span className="font-semibold text-red-200 sm:text-[16px]">
                              -{qty}
                            </span>
                            <span className="mx-2 opacity-40">→</span>
                            <span className="opacity-95">{String(fromAfter ?? "—")}</span>
                          </div>
                          <Badge tone="bad" className="hidden sm:inline-flex">
                            -{qty}
                          </Badge>
                        </div>
                      </Link>
                    ) : (
                      <div className="rounded-2xl border border-border bg-background/20 px-3 py-3">
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground/90 truncate">
                          {fromLabel}
                        </div>
                        <div className="mt-1 text-[13px] sm:text-[14px]">
                          <span className="opacity-80">{String(fromBefore ?? "—")}</span>
                          <span className="mx-2 opacity-40">→</span>
                          <span className="font-semibold text-red-200 sm:text-[16px]">-{qty}</span>
                          <span className="mx-2 opacity-40">→</span>
                          <span className="opacity-95">{String(fromAfter ?? "—")}</span>
                        </div>
                      </div>
                    )}

                    {/* TO */}
                    {hrefTo ? (
                      <Link
                        href={hrefTo}
                        className={cx(
                          "rounded-2xl border border-border bg-background/20 px-3 py-3",
                          "transition hover:bg-card/80 hover:border-border/80 active:scale-[0.995]"
                        )}
                        aria-label={`Zobacz materiał w lokacji: ${toLabel}`}
                      >
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground/90 truncate">
                          {toLabel}
                        </div>

                        <div className="mt-1 flex items-baseline justify-between gap-3">
                          <div className="text-[13px] sm:text-[14px] opacity-85">
                            <span className="opacity-80">{String(toBefore ?? "—")}</span>
                            <span className="mx-2 opacity-40">→</span>
                            <span className="font-semibold text-emerald-200 sm:text-[16px]">
                              +{qty}
                            </span>
                            <span className="mx-2 opacity-40">→</span>
                            <span className="opacity-95">{String(toAfter ?? "—")}</span>
                          </div>
                          <Badge tone="ok" className="hidden sm:inline-flex">
                            +{qty}
                          </Badge>
                        </div>
                      </Link>
                    ) : (
                      <div className="rounded-2xl border border-border bg-background/20 px-3 py-3">
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground/90 truncate">
                          {toLabel}
                        </div>
                        <div className="mt-1 text-[13px] sm:text-[14px]">
                          <span className="opacity-80">{String(toBefore ?? "—")}</span>
                          <span className="mx-2 opacity-40">→</span>
                          <span className="font-semibold text-emerald-200 sm:text-[16px]">+{qty}</span>
                          <span className="mx-2 opacity-40">→</span>
                          <span className="opacity-95">{String(toAfter ?? "—")}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}