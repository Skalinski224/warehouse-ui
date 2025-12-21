// src/app/(app)/inventory/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";

import BackButton from "@/components/BackButton";
import { createInventorySession } from "@/app/(app)/inventory/actions";
import { getInventorySessions } from "@/lib/queries/inventory";
import { supabaseServer } from "@/lib/supabaseServer";
import { PERM, can, type PermissionSnapshot } from "@/lib/permissions";

export const dynamic = "force-dynamic";

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// legacy fallback (na czas przejścia)
function isInventoryRole(role: string | null): boolean {
  return role === "owner" || role === "manager" || role === "storeman";
}

function unwrapSnapshot(data: unknown): PermissionSnapshot | null {
  if (!data) return null;
  if (Array.isArray(data)) return (data[0] as PermissionSnapshot) ?? null;
  return (data as PermissionSnapshot) ?? null;
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
    <span className={`inline-flex items-center rounded px-2 py-1 text-[11px] border ${cls}`}>
      {children}
    </span>
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

export default async function InventoryPage() {
  const supabase = await supabaseServer();

  const { data, error } = await supabase.rpc("my_permissions_snapshot");
  const snapshot = unwrapSnapshot(data);

  if (!snapshot || error) redirect("/");

  // twarde odcięcie dla worker/foreman (jak masz obecnie)
  if (snapshot.role === "worker" || snapshot.role === "foreman") redirect("/");

  // wpuszczamy jeśli:
  // - ma rolę owner/manager/storeman (fallback)
  // - albo ma perm inventory.read (docelowo)
  const canRead = isInventoryRole(snapshot.role) || can(snapshot, PERM.INVENTORY_READ);
  if (!canRead) redirect("/");

  const canManage = isInventoryRole(snapshot.role) || can(snapshot, PERM.INVENTORY_MANAGE);

  async function onCreate() {
    "use server";

    const sb = await supabaseServer();
    const { data, error } = await sb.rpc("my_permissions_snapshot");
    const snap = unwrapSnapshot(data);

    if (!snap || error) redirect("/");
    if (snap.role === "worker" || snap.role === "foreman") redirect("/");

    const allowManage = isInventoryRole(snap.role) || can(snap, PERM.INVENTORY_MANAGE);
    if (!allowManage) redirect("/");

    const { sessionId } = await createInventorySession({
      session_date: todayISO(),
      description: null,
    });

    redirect(`/inventory/new?session=${sessionId}`);
  }

  const { rows } = await getInventorySessions({
    approved: false,
    include_deleted: false,
    limit: 200,
    offset: 0,
  });

  const totalDraft = rows.length;

  return (
    <main className="p-6 space-y-4">
      {/* HEADER (KANON) */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-[760px]">
          <h1 className="text-sm font-medium">Inwentaryzacja</h1>
          <p className="text-xs opacity-70">
            Widzisz tylko rozpoczęte sesje (draft). Zatwierdzone są w:{" "}
            <span className="font-semibold">Raporty → Inwentaryzacja</span>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Pill tone="neutral">
            Draft: <span className="font-semibold ml-1">{totalDraft}</span>
          </Pill>

          <BackButton className="inline-flex items-center justify-center rounded-xl border border-border bg-background px-3 py-2 text-xs hover:bg-foreground/5 transition" />

          {canManage ? (
            <form action={onCreate}>
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-xl border border-border bg-background px-4 py-2 text-xs hover:bg-foreground/5 transition"
              >
                + Dodaj inwentaryzację
              </button>
            </form>
          ) : null}
        </div>
      </header>

      {/* LISTA */}
      {rows.length === 0 ? (
        <EmptyState
          title="Brak rozpoczętych inwentaryzacji"
          desc="Kliknij „Dodaj inwentaryzację”, aby rozpocząć nową sesję."
          ctaHref={canManage ? "/inventory/new" : undefined}
          ctaLabel={canManage ? "Rozpocznij sesję" : undefined}
        />
      ) : (
        <section className="space-y-3">
          {rows.map((r) => {
            const who = r.person?.trim() ? r.person : "—";
            const date = r.session_date;

            return (
              <Link
                key={r.id}
                href={`/inventory/new?session=${r.id}`}
                className={[
                  "block rounded-2xl border border-border bg-card p-4 transition",
                  "hover:bg-foreground/5 hover:border-foreground/20",
                  "focus:outline-none focus:ring-2 focus:ring-foreground/20",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{date}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      <span className="text-muted-foreground/80">Kto:</span>{" "}
                      <span className="text-foreground/90">{who}</span>
                    </div>
                    {r.description ? (
                      <div className="mt-2 text-xs opacity-70 line-clamp-2">{r.description}</div>
                    ) : null}
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <Pill tone="warn">DRAFT</Pill>
                    <span className="text-sm opacity-70">→</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </section>
      )}
    </main>
  );
}
