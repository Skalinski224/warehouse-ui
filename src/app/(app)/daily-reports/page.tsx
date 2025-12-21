// src/app/(app)/daily-reports/page.tsx
import type React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";
import { can, PERM, type PermissionSnapshot } from "@/lib/permissions";
import { approveDailyReport, deleteDailyReportUnapproved } from "./actions";

export const dynamic = "force-dynamic";

type ReportItem = {
  material_id?: string;
  qty_used?: number | string;
  quantity?: number | string; // legacy fallback
};

type PendingRow = {
  id: string;
  date: string;
  person: string;
  crew_name: string | null;
  place: string | null;
  created_at: string | null;
  submitted_at: string | null;
  items: ReportItem[] | null;
};

function fmtDate(isoOrDate: string) {
  const d = new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return isoOrDate;
  return d.toLocaleDateString("pl-PL");
}

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pl-PL");
}

function coerceSnapshot(data: any): PermissionSnapshot | null {
  if (!data) return null;
  if (Array.isArray(data)) return (data[0] as PermissionSnapshot | null) ?? null;
  return data as PermissionSnapshot;
}

function toNum(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function summarizeItems(
  items: ReportItem[] | null | undefined
): { distinctCount: number; totalQty: number } {
  const arr = Array.isArray(items) ? items : [];
  const ids = new Set<string>();
  let total = 0;

  for (const it of arr) {
    const id = typeof it?.material_id === "string" ? it.material_id : "";
    if (id) ids.add(id);
    const qty = toNum((it as any)?.qty_used ?? (it as any)?.quantity);
    total += qty;
  }

  return { distinctCount: ids.size || arr.length, totalQty: total };
}

function fmtQty(n: number) {
  if (!Number.isFinite(n)) return "0";
  const rounded = Math.round(n * 100) / 100;
  return rounded.toLocaleString("pl-PL");
}

function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "ok" | "warn";
}) {
  const cls =
    tone === "ok"
      ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-300"
      : tone === "warn"
      ? "border-amber-500/35 bg-amber-500/10 text-amber-300"
      : "border-border bg-background/60 text-foreground/80";

  return (
    <span
      className={`inline-flex items-center rounded px-2 py-1 text-[11px] border ${cls}`}
    >
      {children}
    </span>
  );
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-xs text-foreground/90">{value}</div>
    </div>
  );
}

function EmptyState({
  title,
  desc,
  ctaHref,
  ctaLabel,
}: {
  title: string;
  desc: string;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="text-sm font-medium">{title}</div>
      <div className="text-xs text-muted-foreground mt-1">{desc}</div>
      {ctaHref && ctaLabel ? (
        <div className="mt-4">
          <Link
            href={ctaHref}
            className="inline-flex items-center justify-center rounded-xl border border-border bg-background px-4 py-2 text-xs hover:bg-foreground/5 transition"
          >
            {ctaLabel} →
          </Link>
        </div>
      ) : null}
    </div>
  );
}

export default async function DailyReportsLandingPage() {
  const supabase = await supabaseServer();

  const { data, error } = await supabase.rpc("my_permissions_snapshot");
  const snapshot = coerceSnapshot(data);

  if (!snapshot || error) redirect("/");

  const canCreate = can(snapshot, PERM.DAILY_REPORTS_CREATE);
  const canRead = can(snapshot, PERM.DAILY_REPORTS_READ);
  const canQueue = can(snapshot, PERM.DAILY_REPORTS_QUEUE); // alias -> approve
  const canApprove = can(snapshot, PERM.DAILY_REPORTS_APPROVE);
  const canDeletePending = can(snapshot, PERM.DAILY_REPORTS_DELETE_UNAPPROVED); // alias -> approve

  if (!canCreate && !canRead && !canQueue && !canApprove) redirect("/");

  const showQueue = canQueue || canApprove;

  // KANON: jeśli user ma “kolejkę”, to landingiem są “do zatwierdzenia”
  if (showQueue) {
    const { data: rows, error: listErr } = await supabase
      .from("daily_reports")
      .select("id,date,person,crew_name,place,created_at,submitted_at,items")
      .eq("approved", false)
      .not("submitted_at", "is", null) // ✅ kolejka
      .is("deleted_at", null)
      .order("submitted_at", { ascending: false })
      .limit(200);

    if (listErr) console.error("[daily-reports/page] list pending error:", listErr);

    const pending = (rows as PendingRow[] | null) ?? [];
    const total = pending.length;
    const byCrew = pending.filter((r) => !!r.crew_name).length;

    return (
      <main className="p-6 space-y-4">
        {/* HEADER (KANON) */}
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-sm font-medium">Raporty dzienne</h1>
            <p className="text-xs opacity-70">
              Kolejka raportów po podsumowaniu. Zatwierdzenie odejmie stany magazynowe.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Pill tone="warn">
              Oczekujące: <span className="font-semibold ml-1">{total}</span>
            </Pill>
            <Pill>
              Brygady: <span className="font-semibold ml-1">{byCrew}</span>
            </Pill>

            {canCreate ? (
              <Link
                href="/daily-reports/new"
                className="inline-flex items-center justify-center rounded-xl border border-border bg-background px-4 py-2 text-xs hover:bg-foreground/5 transition"
              >
                + Dodaj raport
              </Link>
            ) : null}
          </div>
        </header>

        {/* EMPTY */}
        {pending.length === 0 ? (
          <EmptyState
            title="Brak raportów oczekujących"
            desc="Jeśli ktoś zapisze raport (submitted_at), pojawi się tutaj do zatwierdzenia."
            ctaHref={canCreate ? "/daily-reports/new" : undefined}
            ctaLabel={canCreate ? "Dodaj raport" : undefined}
          />
        ) : (
          <section className="space-y-3">
            {pending.map((r) => {
              const s = summarizeItems(r.items);
              const mode = r.crew_name ? "Brygada" : "Solo / Ad-hoc";

              return (
                <div key={r.id} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    {/* LEWA: opis “co to jest” */}
                    <div className="min-w-0 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold">
                          {fmtDate(r.date)}{" "}
                          <span className="text-foreground/60 font-normal">—</span>{" "}
                          {r.person}
                        </div>

                        <Pill>
                          Tryb: <span className="font-semibold ml-1">{mode}</span>
                        </Pill>
                        <Pill>
                          Brygada: <span className="font-semibold ml-1">{r.crew_name || "—"}</span>
                        </Pill>
                        {r.place ? (
                          <Pill>
                            Miejsce: <span className="font-semibold ml-1">{r.place}</span>
                          </Pill>
                        ) : null}
                        <Pill tone="ok">
                          Zużycia: <span className="font-semibold ml-1">{s.distinctCount}</span> • Łącznie:{" "}
                          <span className="font-semibold ml-1">{fmtQty(s.totalQty)}</span>
                        </Pill>
                      </div>

                      {/* META BOX (KANON) */}
                      <div className="grid gap-2 rounded-2xl border border-border bg-background/20 p-3 sm:max-w-xl">
                        <MetaRow label="Zgłoszono" value={fmtDateTime(r.submitted_at)} />
                        <MetaRow label="Utworzono" value={fmtDateTime(r.created_at)} />
                        <MetaRow
                          label="ID"
                          value={<span className="font-mono text-[11px]">{r.id}</span>}
                        />
                      </div>
                    </div>

                    {/* PRAWA: akcje */}
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      {canApprove ? (
                        <form
                          action={async () => {
                            "use server";
                            await approveDailyReport(r.id);
                          }}
                        >
                          <button
                            type="submit"
                            className="rounded-xl border border-border bg-foreground text-background px-4 py-2 text-xs font-semibold hover:bg-foreground/90 transition"
                          >
                            Zatwierdź
                          </button>
                        </form>
                      ) : null}

                      <Link
                        href={`/reports/daily/${r.id}`}
                        className="rounded-xl border border-border bg-background px-4 py-2 text-xs hover:bg-foreground/5 transition"
                      >
                        Podgląd
                      </Link>

                      {canDeletePending ? (
                        <form
                          action={async () => {
                            "use server";
                            await deleteDailyReportUnapproved(r.id);
                          }}
                        >
                          <button
                            type="submit"
                            className="rounded-xl border border-destructive/40 bg-background px-4 py-2 text-xs text-destructive hover:bg-destructive/10 transition"
                          >
                            Usuń
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        )}
      </main>
    );
  }

  // KANON: jeśli nie ma kolejki, to landing “szybki start”
  if (!canCreate) {
    return (
      <main className="p-6">
        <EmptyState title="Brak uprawnień" desc="Nie masz dostępu do tworzenia raportów dziennych." />
      </main>
    );
  }

  return (
    <main className="p-6">
      <div className="rounded-2xl border border-border bg-card p-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-medium">Raporty dzienne</div>
          <div className="text-xs opacity-70">
            Dodaj nowy raport dzienny lub przejdź do raportów, jeśli masz uprawnienia.
          </div>
        </div>

        <Link
          href="/daily-reports/new"
          className="inline-flex items-center justify-center rounded-xl border border-border bg-foreground text-background px-5 py-2 text-xs font-semibold hover:bg-foreground/90 transition"
        >
          + Dodaj raport dzienny
        </Link>
      </div>
    </main>
  );
}
