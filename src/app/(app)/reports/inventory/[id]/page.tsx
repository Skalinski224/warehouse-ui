// src/app/(app)/reports/inventory/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";

import BackButton from "@/components/BackButton";
import { supabaseServer } from "@/lib/supabaseServer";
import { getInventorySessionDetails } from "@/lib/queries/inventory";
import { getPermissionSnapshot } from "@/lib/currentUser";
import { can, PERM } from "@/lib/permissions";

type Params = Promise<{ id: string }>;

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
  tone?: "neutral" | "ok" | "warn" | "bad";
  className?: string;
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
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground/90">{label}</div>
      <div className={cx("text-[15px] leading-snug", strong && "font-semibold")}>{value}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function fmtUnit(unit: string | null) {
  return unit?.trim() ? ` ${unit.trim()}` : "";
}

function n(v: any) {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

function diffTone(diff: number | null): "neutral" | "ok" | "bad" {
  if (diff === null || diff === 0) return "neutral";
  return diff > 0 ? "ok" : "bad";
}

function DiffPill({ diff }: { diff: number | null }) {
  if (diff === null) return <Badge className="px-2">—</Badge>;
  if (diff === 0) return <Badge className="px-2">0</Badge>;
  return (
    <Badge className="px-2" tone={diff > 0 ? "ok" : "bad"}>
      {diff > 0 ? `+${diff}` : String(diff)}
    </Badge>
  );
}

async function resolveUserFullName(userId: string | null): Promise<string | null> {
  if (!userId) return null;

  try {
    const sb = await supabaseServer();

    const { data: tm, error: tmErr } = await sb
      .from("team_members")
      .select("first_name,last_name,email")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    if (!tmErr && tm) {
      const fn = String((tm as any).first_name ?? "").trim();
      const ln = String((tm as any).last_name ?? "").trim();
      const full = `${fn} ${ln}`.trim();
      if (full) return full;

      const email = String((tm as any).email ?? "").trim();
      if (email) return email;
    }

    return null;
  } catch {
    return null;
  }
}

export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default async function ReportInventoryDetailsPage({ params }: { params: Params }) {
  // ✅ Gate
  const snap = await getPermissionSnapshot();
  if (!can(snap, PERM.REPORTS_INVENTORY_READ)) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="text-sm text-foreground/80">Brak dostępu.</div>
      </div>
    );
  }

  const { id } = await params;

  const { meta, items } = await getInventorySessionDetails(id);
  if (!meta) notFound();

  // Raporty pokazujemy tylko dla zatwierdzonych
  if (!meta.approved) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-card p-4 text-sm opacity-80">
          Ta inwentaryzacja nie jest zatwierdzona (draft) i nie należy do raportów.
          <div className="mt-2">
            <Link
              className="underline underline-offset-2"
              href={`/inventory/new?session=${meta.session_id}`}
            >
              Przejdź do draftu
            </Link>
          </div>
        </div>

        <BackButton />
      </div>
    );
  }

  // ✅ Source-of-truth: inventory_sessions (lokacja + created_by + approved_by)
  const sb = await supabaseServer();

  const { data: sessionRow } = await sb
    .from("inventory_sessions")
    .select(
      `
      id,
      session_date,
      created_at,
      created_by,
      approved_at,
      approved_by,
      inventory_location_id,
      inventory_locations:inventory_location_id ( label )
    `
    )
    .eq("id", meta.session_id)
    .maybeSingle();

  const createdById = ((sessionRow as any)?.created_by ?? null) as string | null;
  const approvedById = ((sessionRow as any)?.approved_by ?? null) as string | null;

  const [createdByName, approvedByName] = await Promise.all([
    resolveUserFullName(createdById),
    resolveUserFullName(approvedById),
  ]);

  const inventoryLocationLabel =
    ((sessionRow as any)?.inventory_locations?.label ?? null) ||
    ((sessionRow as any)?.inventory_location_id ?? null) ||
    "—";

  const missingCount = items.filter((i) => i.counted_qty === null).length;
  const diffCount = items.filter((i) => i.counted_qty !== null && i.counted_qty !== i.system_qty).length;

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-base font-semibold">Inwentaryzacja</h1>
          <p className="text-xs opacity-70">Szczegóły zatwierdzonej sesji inwentaryzacyjnej.</p>
        </div>

        <div className="flex items-center gap-2">
          <Badge className="px-3" tone="ok">
            zatwierdzona
          </Badge>
          <Badge className="px-3">ID #{String(meta.session_id).slice(0, 8)}</Badge>
        </div>
      </header>

      {/* META PANEL */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm font-medium">Podstawowe informacje</div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge tone="neutral">{items.length} pozycji</Badge>
              <Badge tone={missingCount > 0 ? "warn" : "neutral"}>{missingCount} braków</Badge>
              <Badge tone={diffCount > 0 ? "warn" : "neutral"}>{diffCount} zmian</Badge>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Data" value={meta.session_date || "—"} strong />
            <Field label="Lokalizacja magazynowa" value={inventoryLocationLabel} strong />

            <Field label="Utworzył" value={createdByName ?? "—"} />
            <Field label="Zatwierdził" value={approvedByName ?? "—"} />

            <Field label="Pozycje" value={items.length} />
            <Field label="Braki / zmiany" value={`${missingCount} / ${diffCount}`} />
          </div>
        </div>
      </section>

      {/* ITEMS */}
      {items.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-4 text-sm opacity-70">
          Brak pozycji w tej inwentaryzacji.
        </div>
      ) : (
        <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-sm font-medium">Pozycje</h2>
              <div className="text-xs opacity-70">Pozycje: {items.length}</div>
            </div>
            <Badge>braki: {missingCount}</Badge>
          </div>

          <div className="space-y-2">
            {items.map((i) => {
              const unit = i.material_unit ?? null;
              const diff = i.counted_qty !== null ? n(i.counted_qty) - n(i.system_qty) : null;

              const systemLabel = `${n(i.system_qty)}${fmtUnit(unit)}`;
              const countedLabel = i.counted_qty === null ? "—" : `${n(i.counted_qty)}${fmtUnit(unit)}`;

              return (
                <Link
                  key={i.item_id}
                  href={`/materials/${i.material_id}`}
                  className={cx(
                    "block rounded-2xl border border-border bg-background/30 px-3 py-3",
                    "transition hover:bg-card/80 hover:border-border/80 active:scale-[0.995]"
                  )}
                >
                  {/* header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[15px] font-semibold truncate">{i.material_title}</div>
                      <div className="text-xs opacity-70 mt-0.5">
                        System: <span className="opacity-95">{systemLabel}</span>
                        <span className="mx-2 opacity-40">•</span>
                        Faktyczny: <span className="opacity-95">{countedLabel}</span>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground/90">
                        Różnica
                      </div>
                      <div className="mt-0.5">
                        <DiffPill diff={diff} />
                      </div>
                    </div>
                  </div>

                  {/* two panels: ALWAYS 1 ROW ON MOBILE (grid-cols-2) */}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-2xl border border-border bg-background/20 px-3 py-2 sm:py-3">
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground/90">
                        Stan przed
                      </div>
                      <div className="mt-1 text-[15px] sm:text-[16px] font-semibold">{systemLabel}</div>
                    </div>

                    <div className="rounded-2xl border border-border bg-background/20 px-3 py-2 sm:py-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground/90">
                          Stan po
                        </div>
                        <Badge tone={diffTone(diff)} className="px-2">
                          {diff === null ? "—" : diff > 0 ? `+${diff}` : String(diff)}
                        </Badge>
                      </div>

                      <div className="mt-1 text-[15px] sm:text-[16px] font-semibold">{countedLabel}</div>

                      {diff !== null && diff !== 0 ? (
                        <div className="mt-1 text-xs opacity-75">
                          {diff > 0 ? (
                            <span className="text-emerald-200">nadwyżka</span>
                          ) : (
                            <span className="text-red-200">niedobór</span>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}