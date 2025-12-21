// src/app/(app)/inventory/[id]/summary/page.tsx
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import BackButton from "@/components/BackButton";
import { getInventorySessionDetails } from "@/lib/queries/inventory";
import { approveInventorySession } from "@/app/(app)/inventory/actions";
import { supabaseServer } from "@/lib/supabaseServer";
import type { PermissionSnapshot } from "@/lib/permissions";

type Params = Promise<{ id: string }>;

export const dynamic = "force-dynamic";

function fmtDiff(diff: number) {
  if (!Number.isFinite(diff)) return "—";
  if (diff > 0) return `+${diff}`;
  return `${diff}`;
}

function diffBadgeClasses(diff: number | null) {
  if (diff === null) return "border-border text-muted-foreground bg-background/10";
  if (diff === 0) return "border-border text-muted-foreground bg-background/10";
  if (diff > 0) return "border-emerald-500/40 text-emerald-300 bg-emerald-500/10";
  return "border-red-500/40 text-red-300 bg-red-500/10";
}

export default async function InventorySummaryPage({ params }: { params: Params }) {
  const supabase = await supabaseServer();

  const { data, error } = await supabase.rpc("my_permissions_snapshot");
  const snapshot = (data as PermissionSnapshot | null) ?? null;

  if (!snapshot || error) redirect("/");
  if (snapshot.role === "worker" || snapshot.role === "foreman") redirect("/");

  const { id } = await params;

  const { meta, items } = await getInventorySessionDetails(id);
  if (!meta) notFound();

  const sessionId = meta.session_id;

  const missingCount = items.filter((i) => i.counted_qty === null).length;
  const hasItems = items.length > 0;
  const canApprove = hasItems && missingCount === 0;

  async function onApprove() {
    "use server";
    await approveInventorySession(sessionId);
    redirect("/inventory");
  }

  if (meta.approved) {
    return (
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="max-w-[760px]">
            <h1 className="text-lg font-semibold">Podsumowanie inwentaryzacji</h1>
            <p className="text-xs text-muted-foreground">
              Ta sesja jest już zatwierdzona.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <BackButton className="card inline-flex items-center px-3 py-2 text-xs font-medium" />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground">
          Data: <span className="text-foreground">{meta.session_date}</span>
          <span className="mx-2">•</span>
          Pozycje: <span className="text-foreground">{items.length}</span>
        </div>

        <Link href="/inventory" className="text-xs underline underline-offset-2">
          Wróć do listy
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="max-w-[760px]">
          <h1 className="text-lg font-semibold">Podsumowanie inwentaryzacji</h1>
          <p className="text-xs text-muted-foreground">
            Sprawdź dane. Dopiero kliknięcie „Przyjmij” wprowadzi zmiany w systemie.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <BackButton className="card inline-flex items-center px-3 py-2 text-xs font-medium" />
          <Link
            href={`/inventory/new?session=${sessionId}`}
            className="card inline-flex items-center px-3 py-2 text-xs font-medium"
          >
            Edytuj
          </Link>
        </div>
      </div>

      {/* Meta tiles */}
      <div className="rounded-2xl border border-border bg-card p-3 sm:p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-1">
            <div className="text-xs opacity-60">Data</div>
            <div className="text-sm font-medium">{meta.session_date || "—"}</div>
          </div>

          <div className="grid gap-1">
            <div className="text-xs opacity-60">Pozycje</div>
            <div className="text-sm font-medium">{items.length}</div>
          </div>

          <div className="grid gap-1">
            <div className="text-xs opacity-60">Braki</div>
            <div className="text-sm font-medium">{missingCount}</div>
          </div>

          <div className="grid gap-1">
            <div className="text-xs opacity-60">Status</div>
            <div className="inline-flex">
              <span className="rounded-xl border border-border bg-background/10 px-3 py-1 text-[11px] text-muted-foreground">
                Draft
              </span>
            </div>
          </div>
        </div>

        {meta.description ? (
          <div className="mt-3 border-t border-border/70 pt-3">
            <div className="text-xs opacity-60">Opis</div>
            <div className="mt-1 text-sm">{meta.description}</div>
          </div>
        ) : null}
      </div>

      {/* Warning / gating */}
      {!hasItems ? (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          Brak pozycji w sesji. Wróć do edycji i dodaj materiały.
        </div>
      ) : missingCount > 0 ? (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          Uzupełnij brakujące pozycje (faktyczny stan) przed zatwierdzeniem.
        </div>
      ) : (
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          Wszystkie pozycje uzupełnione — możesz zatwierdzić.
        </div>
      )}

      {/* Items list (mobile-first cards) */}
      <div className="rounded-2xl border border-border bg-card p-3 sm:p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Pozycje</div>
            <div className="text-xs opacity-70">
              Każda karta pokazuje stan w systemie, policzony i różnicę.
            </div>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="rounded-xl border border-border bg-background/10 p-3 text-sm text-muted-foreground">
            Brak pozycji.
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((i) => {
              const unit = i.material_unit ?? "";
              const diff =
                i.counted_qty !== null ? i.counted_qty - i.system_qty : null;

              return (
                <div
                  key={i.item_id}
                  className={[
                    "rounded-2xl border border-border bg-background/20 p-3",
                    "transition hover:bg-background/30 hover:border-foreground/15",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {i.material_title}
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        ID: <span className="opacity-80">{i.material_id}</span>
                      </div>
                    </div>

                    <span
                      className={[
                        "shrink-0 rounded-xl border px-2.5 py-1 text-[11px]",
                        diffBadgeClasses(diff),
                      ].join(" ")}
                      title="Różnica = faktyczny - system"
                    >
                      {diff === null ? "Brak" : fmtDiff(diff)}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <div className="rounded-xl border border-border bg-background/10 px-3 py-2">
                      <div className="text-[11px] text-muted-foreground">System</div>
                      <div className="text-sm font-medium">
                        {i.system_qty}
                        {unit ? ` ${unit}` : ""}
                      </div>
                    </div>

                    <div className="rounded-xl border border-border bg-background/10 px-3 py-2">
                      <div className="text-[11px] text-muted-foreground">Faktyczny</div>
                      <div className="text-sm font-medium">
                        {i.counted_qty === null ? "—" : i.counted_qty}
                        {unit ? ` ${unit}` : ""}
                      </div>
                    </div>

                    <div className="rounded-xl border border-border bg-background/10 px-3 py-2">
                      <div className="text-[11px] text-muted-foreground">Różnica</div>
                      <div className="text-sm font-medium">
                        {diff === null ? "—" : fmtDiff(diff)}
                        {diff !== null && unit ? ` ${unit}` : ""}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sticky-ish footer actions (good for mobile) */}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href={`/inventory/new?session=${sessionId}`}
          className="rounded-xl border border-border bg-card px-4 py-2 text-sm hover:bg-card/80 transition"
        >
          ← Wróć do edycji
        </Link>

        <form action={onApprove}>
          <button
            type="submit"
            disabled={!canApprove}
            className="w-full sm:w-auto rounded-xl border border-border bg-foreground px-4 py-2 text-sm text-background hover:bg-foreground/90 disabled:opacity-60 disabled:cursor-not-allowed transition"
            title={!canApprove ? "Uzupełnij brakujące pozycje przed zatwierdzeniem." : ""}
          >
            Przyjmij inwentaryzację
          </button>
        </form>
      </div>

      <div className="text-[11px] text-muted-foreground">
        Zatwierdzenie nadpisze stany magazynowe na podstawie policzonych ilości.
      </div>
    </div>
  );
}
