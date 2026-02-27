// src/app/(app)/inventory/page.tsx
import type React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import BackButton from "@/components/BackButton";
import { supabaseServer } from "@/lib/supabaseServer";
import { PERM, can, type PermissionSnapshot } from "@/lib/permissions";

import StartInventorySessionModal from "@/app/(app)/inventory/_components/StartInventorySessionModal";
import DeleteInventorySessionButton from "@/app/(app)/inventory/_components/DeleteInventorySessionButton";

export const dynamic = "force-dynamic";

// legacy fallback (na czas przejścia)
function isInventoryRole(role: string | null): boolean {
  return role === "owner" || role === "manager" || role === "storeman";
}

function unwrapSnapshot(data: unknown): PermissionSnapshot | null {
  if (!data) return null;
  if (Array.isArray(data)) return (data[0] as PermissionSnapshot) ?? null;
  return (data as PermissionSnapshot) ?? null;
}

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

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-xs text-foreground/90 text-right">{value}</div>
    </div>
  );
}

function EmptyState({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="text-sm font-medium">{title}</div>
      <div className="text-xs text-muted-foreground mt-1">{desc}</div>
    </div>
  );
}

type BaseSessionRow = {
  id: string;
  account_id: string;
  session_date: string;
  created_at: string | null;
  created_by: string | null;
  description: string | null;
  approved: boolean;
  approved_at: string | null;
  approved_by: string | null;
  deleted_at: string | null;
  inventory_location_id: string | null;
};

type UiSessionRow = {
  id: string;
  account_id: string;
  session_date: string;
  created_at: string;

  created_by: string | null;
  person: string | null;

  description: string | null;
  approved: boolean;

  approved_at: string | null;
  approved_by: string | null;

  deleted_at: string | null;

  inventory_location_id: string | null;
  inventory_location_label: string | null;

  items_count: number | null;
};

export default async function InventoryPage() {
  const supabase = await supabaseServer();

  const { data, error } = await supabase.rpc("my_permissions_snapshot");
  const snapshot = unwrapSnapshot(data);

  if (!snapshot || error) redirect("/");
  if (snapshot.role === "worker" || snapshot.role === "foreman") redirect("/");

  const canRead = isInventoryRole(snapshot.role) || can(snapshot, PERM.INVENTORY_READ);
  if (!canRead) redirect("/");

  const canManage = isInventoryRole(snapshot.role) || can(snapshot, PERM.INVENTORY_MANAGE);

  // ✅ źródło prawdy: inventory_sessions (drafty)
  const baseRes = await supabase
    .from("inventory_sessions")
    .select(
      "id,account_id,session_date,created_at,created_by,description,approved,approved_at,approved_by,deleted_at,inventory_location_id"
    )
    .eq("approved", false)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);

  const base = (baseRes.data ?? []) as BaseSessionRow[];

  let rows: UiSessionRow[] = [];

  if (base.length > 0) {
    const accountId = base[0]?.account_id ?? null;

    const userIds = Array.from(new Set(base.map((x) => x.created_by).filter(Boolean).map(String)));
    const locIds = Array.from(
      new Set(base.map((x) => x.inventory_location_id).filter(Boolean).map(String))
    );

    const usersMap = new Map<string, string>();
    if (accountId && userIds.length > 0) {
      const uRes = await supabase
        .from("users")
        .select("user_id,name,email,account_id")
        .eq("account_id", accountId)
        .in("user_id", userIds);

      (uRes.data ?? []).forEach((u: any) => {
        const person =
          u?.name && String(u.name).trim()
            ? String(u.name)
            : u?.email
            ? String(u.email)
            : "—";
        if (u?.user_id) usersMap.set(String(u.user_id), person);
      });
    }

    const locMap = new Map<string, string>();
    if (accountId && locIds.length > 0) {
      const lRes = await supabase
        .from("inventory_locations")
        .select("id,label,account_id,deleted_at")
        .eq("account_id", accountId)
        .is("deleted_at", null)
        .in("id", locIds);

      (lRes.data ?? []).forEach((l: any) => {
        if (l?.id) locMap.set(String(l.id), l?.label ? String(l.label) : "—");
      });
    }

    // ✅ items_count (batch)
    const ids = base.map((r) => r.id);
    const iiRes = await supabase.from("inventory_items").select("session_id").in("session_id", ids);

    const counts = new Map<string, number>();
    (iiRes.data ?? []).forEach((x: any) => {
      const sid = x?.session_id ? String(x.session_id) : null;
      if (!sid) return;
      counts.set(sid, (counts.get(sid) ?? 0) + 1);
    });

    rows = base.map((s) => ({
      id: s.id,
      account_id: s.account_id,
      session_date: s.session_date,
      created_at: s.created_at ?? "",
      created_by: s.created_by ?? null,
      person: s.created_by ? usersMap.get(String(s.created_by)) ?? "—" : "—",
      description: s.description ?? null,
      approved: s.approved,
      approved_at: s.approved_at ?? null,
      approved_by: s.approved_by ?? null,
      deleted_at: s.deleted_at ?? null,
      inventory_location_id: s.inventory_location_id ?? null,
      inventory_location_label: s.inventory_location_id
        ? locMap.get(String(s.inventory_location_id)) ?? null
        : null,
      items_count: counts.get(String(s.id)) ?? 0,
    }));
  }

  const totalDraft = rows.length;

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-sm font-medium">Inwentaryzacja</h1>
          <p className="text-xs opacity-70">
            Sesja zapisuje się na bieżąco — możesz przerwać i wrócić później. Dopiero{" "}
            <span className="font-semibold">Zatwierdzenie</span> zmienia stany magazynowe.
          </p>
        </div>

        {/* ✅ Back zawsze skrajnie po prawej */}
        <div className="flex flex-col gap-2 sm:items-end">
          <div className="flex items-center justify-end gap-2">
            {canManage ? (
              // wymuszamy, żeby button z modala nie robił się w-full na mobile
              <div className="[&>button]:w-auto [&>button]:px-4 [&>button]:py-2 [&>button]:text-xs">
                <StartInventorySessionModal />
              </div>
            ) : null}

            <BackButton />
          </div>

          <div className="flex items-center justify-end gap-2">
            <Pill tone="warn">
              Drafty: <span className="font-semibold ml-1">{totalDraft}</span>
            </Pill>
          </div>
        </div>
      </header>

      {rows.length === 0 ? (
        <EmptyState
          title="Brak rozpoczętych sesji"
          desc="Kliknij „Rozpocznij sesję”, wybierz lokalizację i zacznij liczenie. Jeśli zamkniesz aplikację, nic nie zginie — wrócisz do tego samego draftu."
        />
      ) : (
        <section className="space-y-3">
          {rows.map((r) => {
            const who = r.person?.trim() ? r.person : "—";
            const date = r.session_date;
            const createdAt = r.created_at ?? null;

            const loc = r.inventory_location_label?.trim()
              ? r.inventory_location_label
              : r.inventory_location_id
              ? "Lokalizacja"
              : "—";

            const itemsCount = r.items_count ?? null;
            const desc = r.description?.trim() ? r.description.trim() : "";

            return (
              <div key={r.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold">
                        {fmtDate(date)}{" "}
                        <span className="text-foreground/60 font-normal">—</span> {who}
                      </div>

                      <Pill tone="warn">DRAFT</Pill>

                      <Pill>
                        Pozycje:{" "}
                        <span className="font-semibold ml-1">
                          {itemsCount === null ? "—" : String(itemsCount)}
                        </span>
                      </Pill>

                      {desc ? (
                        <Pill>
                          Opis:{" "}
                          <span className="font-semibold ml-1 truncate max-w-[260px] inline-block align-bottom">
                            {desc}
                          </span>
                        </Pill>
                      ) : null}
                    </div>

                    <div className="grid gap-2 rounded-2xl border border-border bg-background/20 p-3 sm:max-w-xl">
                      <MetaRow label="Data sesji" value={fmtDate(date)} />
                      <MetaRow label="Utworzono" value={fmtDateTime(createdAt)} />
                      <MetaRow label="Lokalizacja" value={loc} />
                    </div>
                  </div>

                  {/* ✅ mobile: nadal w jednym “rzędzie” (wrap jak brak miejsca), bez full-width */}
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Link
                      href={`/inventory/new?session=${r.id}`}
                      className="rounded-xl border border-border bg-foreground text-background px-4 py-2 text-xs font-semibold hover:bg-foreground/90 transition"
                    >
                      Kontynuuj
                    </Link>

                    <Link
                      href={`/inventory/${r.id}/summary`}
                      className="rounded-xl border border-border bg-background px-4 py-2 text-xs hover:bg-foreground/5 transition"
                    >
                      Podsumowanie
                    </Link>

                    {canManage ? <DeleteInventorySessionButton sessionId={r.id} /> : null}
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}