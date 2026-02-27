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

async function resolvePersonForSession(meta: any): Promise<string> {
  const createdBy = meta?.created_by ? String(meta.created_by) : "";
  const accountId = meta?.account_id ? String(meta.account_id) : "";

  if (!createdBy) return "—";

  const supabase = await supabaseServer();

  // 1) team_members (najlepsze)
  const { data: tm } = await supabase
    .from("team_members")
    .select("first_name,last_name,account_id,deleted_at,user_id")
    .eq("user_id", createdBy)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  const full = [tm?.first_name, tm?.last_name].filter(Boolean).join(" ").trim();
  if (full) return full;

  // 2) users (fallback)
  if (accountId) {
    const { data: u } = await supabase
      .from("users")
      .select("user_id,name,email,account_id")
      .eq("account_id", accountId)
      .eq("user_id", createdBy)
      .limit(1)
      .maybeSingle();

    const name = u?.name && String(u.name).trim() ? String(u.name) : "";
    if (name) return name;

    const email = u?.email && String(u.email).trim() ? String(u.email) : "";
    if (email) return email;
  }

  return "—";
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

  const who = await resolvePersonForSession(meta as any);

  async function onApprove() {
    "use server";

    // ✅ łapiemy tylko błąd RPC/akcji, NIE redirect()
    try {
      await approveInventorySession(sessionId);
    } catch (e: any) {
      const msg =
        e?.message && String(e.message).trim()
          ? String(e.message)
          : "Nie udało się zatwierdzić inwentaryzacji.";
      const toast = encodeURIComponent(msg);
      redirect(`/inventory?toast=${toast}&tone=err`);
    }

    const toast = encodeURIComponent(
      "Inwentaryzacja została zatwierdzona — stany magazynowe zaktualizowane."
    );
    redirect(`/inventory?toast=${toast}&tone=ok`);
  }

  const ActionBtn = (props: {
    href?: string;
    onSubmit?: boolean;
    disabled?: boolean;
    children: React.ReactNode;
    variant?: "card" | "primary";
    title?: string;
    className?: string;
  }) => {
    const base =
      "inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm transition disabled:opacity-60 disabled:cursor-not-allowed";
    const card = "border-border bg-card hover:bg-card/80";
    const primary = "border-border bg-foreground text-background hover:bg-foreground/90";

    const cls = [base, props.variant === "primary" ? primary : card, props.className]
      .filter(Boolean)
      .join(" ");

    if (props.href) {
      return (
        <Link href={props.href} className={cls} title={props.title}>
          {props.children}
        </Link>
      );
    }

    // button in form
    return (
      <button type="submit" disabled={props.disabled} className={cls} title={props.title}>
        {props.children}
      </button>
    );
  };

  // Approved view
  if (meta.approved) {
    return (
      <div className="space-y-4">
        <div className="mx-auto w-full max-w-[980px] space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-[760px]">
              <div className="text-sm font-medium">Podsumowanie inwentaryzacji</div>
              <div className="text-xs opacity-70">Ta sesja jest już zatwierdzona.</div>
            </div>

            {/* ✅ Back skrajnie po prawej */}
            <div className="flex items-center gap-2">
              <ActionBtn href="/inventory" variant="card">
                Lista
              </ActionBtn>
              <BackButton className="rounded-xl border border-border bg-card px-4 py-2 text-sm hover:bg-card/80 transition" />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-3 sm:p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="grid gap-1 min-w-0">
                <div className="text-xs opacity-60">Data</div>
                <div className="text-sm font-medium truncate">{meta.session_date || "—"}</div>
              </div>

              <div className="grid gap-1 min-w-0">
                <div className="text-xs opacity-60">Lokalizacja</div>
                <div className="text-sm font-medium truncate">
                  {meta.inventory_location_label ?? "—"}
                </div>
              </div>

              <div className="grid gap-1 min-w-0">
                <div className="text-xs opacity-60">Pozycje</div>
                <div className="text-sm font-medium">{items.length}</div>
              </div>

              <div className="grid gap-1 min-w-0">
                <div className="text-xs opacity-60">Braki</div>
                <div className="text-sm font-medium">0</div>
              </div>
            </div>

            {/* ✅ kto wypełnił – szeroki blok (2 linie) */}
            <div className="mt-3 border-t border-border/70 pt-3">
              <div className="text-xs opacity-60">Kto wypełnił</div>
              <div className="mt-1 text-sm font-medium leading-snug break-words">{who}</div>
            </div>

            {meta.description ? (
              <div className="mt-3 border-t border-border/70 pt-3">
                <div className="text-xs opacity-60">Opis</div>
                <div className="mt-1 text-sm">{meta.description}</div>
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            Zatwierdzono — stany magazynowe zostały zaktualizowane.
          </div>

          <div className="text-[11px] text-muted-foreground">
            Jeśli chcesz wrócić do sesji, przejdź do listy inwentaryzacji.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="mx-auto w-full max-w-[980px] space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-[760px]">
            <div className="text-sm font-medium">Podsumowanie inwentaryzacji</div>
            <div className="text-xs opacity-70">
              Sprawdź dane. Dopiero kliknięcie „Przyjmij” wprowadzi zmiany w systemie.
            </div>
          </div>

          {/* ✅ przyciski po prawej */}
          <div className="flex items-center gap-2">
            <ActionBtn href={`/inventory/new?session=${sessionId}`} variant="card">
              Edytuj
            </ActionBtn>
            <BackButton className="rounded-xl border border-border bg-card px-4 py-2 text-sm hover:bg-card/80 transition" />
          </div>
        </div>

        {/* Meta tiles */}
        <div className="rounded-2xl border border-border bg-card p-3 sm:p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="grid gap-1 min-w-0">
              <div className="text-xs opacity-60">Data</div>
              <div className="text-sm font-medium truncate">{meta.session_date || "—"}</div>
            </div>

            <div className="grid gap-1 min-w-0">
              <div className="text-xs opacity-60">Lokalizacja</div>
              <div className="text-sm font-medium truncate">
                {meta.inventory_location_label || "—"}
              </div>
            </div>

            <div className="grid gap-1 min-w-0">
              <div className="text-xs opacity-60">Pozycje</div>
              <div className="text-sm font-medium">{items.length}</div>
            </div>

            <div className="grid gap-1 min-w-0">
              <div className="text-xs opacity-60">Braki</div>
              <div className="text-sm font-medium">{missingCount}</div>
            </div>
          </div>

          {/* ✅ kto wypełnił – szeroki blok (2 linie) */}
          <div className="mt-3 border-t border-border/70 pt-3">
            <div className="text-xs opacity-60">Kto wypełnił</div>
            <div className="mt-1 text-sm font-medium leading-snug break-words">{who}</div>
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
            Uzupełnij brakujące pozycje (stan faktyczny) przed zatwierdzeniem.
          </div>
        ) : (
          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            Wszystkie pozycje uzupełnione — możesz zatwierdzić.
          </div>
        )}

        {/* Items list */}
        <div className="rounded-2xl border border-border bg-card p-3 sm:p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Pozycje</div>
              <div className="text-xs opacity-70">
                To jest podgląd — tutaj już nic nie edytujesz.
              </div>
            </div>

            {/* ✅ licznik jak w formularzu */}
            <span className="text-[11px] px-2 py-1 rounded bg-background/60 border border-border">
              Pozycje: <span className="font-semibold">{items.length}</span>
            </span>
          </div>

          {items.length === 0 ? (
            <div className="rounded-xl border border-border bg-background/10 p-3 text-sm text-muted-foreground">
              Brak pozycji.
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((i) => {
                const unit = i.material_unit ?? "";
                const diff = i.counted_qty !== null ? i.counted_qty - i.system_qty : null;

                return (
                  <div
                    key={i.item_id}
                    className="rounded-2xl border border-border bg-background/20 p-3 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{i.material_title}</div>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          System: <span className="opacity-90">{i.system_qty}</span>
                          {unit ? ` ${unit}` : ""}
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

                    {/* ✅ 1 rząd / 3 kolumny jak w formularzu (bez edycji) */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="grid gap-2">
                        <div className="text-[11px] text-muted-foreground">System</div>
                        <div className="h-10 rounded-xl border border-border bg-background/10 px-3 text-sm flex items-center">
                          {i.system_qty}
                          {unit ? ` ${unit}` : ""}
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <div className="text-[11px] text-muted-foreground">Faktyczny</div>
                        <div className="h-10 rounded-xl border border-border bg-background/10 px-3 text-sm flex items-center">
                          {i.counted_qty === null ? "—" : i.counted_qty}
                          {unit ? ` ${unit}` : ""}
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <div className="text-[11px] text-muted-foreground">Różnica</div>
                        <div className="h-10 rounded-xl border border-border bg-background/10 px-3 text-sm flex items-center">
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

        {/* Footer actions */}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <ActionBtn href={`/inventory/new?session=${sessionId}`} variant="card" className="w-full sm:w-auto">
            ← Wróć do edycji
          </ActionBtn>

          <form action={onApprove} className="w-full sm:w-auto">
            <ActionBtn
              variant="primary"
              onSubmit
              disabled={!canApprove}
              title={!canApprove ? "Uzupełnij brakujące pozycje przed zatwierdzeniem." : ""}
              className="w-full sm:w-auto"
            >
              Przyjmij inwentaryzację
            </ActionBtn>
          </form>
        </div>

        <div className="text-[11px] text-muted-foreground">
          Przyjęcie sesji nadpisze stany magazynowe na podstawie policzonych ilości.
        </div>
      </div>
    </div>
  );
}