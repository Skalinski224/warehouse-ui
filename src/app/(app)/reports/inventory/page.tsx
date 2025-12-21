// src/app/(app)/reports/inventory/page.tsx
import Link from "next/link";

import BackButton from "@/components/BackButton";
import { supabaseServer } from "@/lib/supabaseServer";
import { getInventorySessions } from "@/lib/queries/inventory";
import InventoryReportsFilters from "@/app/(app)/reports/inventory/_components/InventoryReportsFilters";
import { getPermissionSnapshot } from "@/lib/currentUser";
import { can, PERM } from "@/lib/permissions";

type SP = Record<string, string | string[] | undefined>;

function sp1(sp: SP, key: string): string {
  const v = sp[key];
  if (!v) return "";
  return Array.isArray(v) ? v[0] ?? "" : v;
}

function StatPill({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="text-[11px] px-2 py-1 rounded bg-background/60 border border-border">
      <span className="opacity-70">{label}:</span>{" "}
      <span className="font-semibold opacity-100">{value}</span>
    </div>
  );
}

function FilterPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] px-2 py-1 rounded bg-background/40 border border-border text-foreground/80">
      {children}
    </span>
  );
}

/** jak w deliveries */
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

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Tag>{label}</Tag>
      <span className="text-sm">{value}</span>
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

async function getItemsCount(sessionId: string) {
  const supabase = await supabaseServer();
  const { count } = await supabase
    .from("inventory_items")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId);

  return Number(count ?? 0);
}

export default async function ReportsInventoryPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  // ✅ Gate: tylko storeman/manager/owner przez permission
  const snap = await getPermissionSnapshot();
  if (!can(snap, PERM.REPORTS_INVENTORY_READ)) {
    return (
      <main className="p-6">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="text-sm text-foreground/80">Brak dostępu.</div>
        </div>
      </main>
    );
  }

  const sp = await searchParams;

  const from = sp1(sp, "from") || null;
  const to = sp1(sp, "to") || null;
  const q = sp1(sp, "q") || null;

  const { rows } = await getInventorySessions({
    approved: true,
    include_deleted: false,
    from,
    to,
    q,
    limit: 200,
    offset: 0,
  });

  const rowsWithCounts = await Promise.all(
    rows.map(async (r) => ({
      ...r,
      items_count: await getItemsCount(r.id),
    }))
  );

  const activeFilters = [
    from ? `Od: ${from}` : null,
    to ? `Do: ${to}` : null,
    q?.trim() ? `Szukaj: ${q.trim()}` : null,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-4">
      {/* HEADER (KANON) */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-sm font-medium">Raport: inwentaryzacja</h1>
          <p className="text-xs opacity-70">
            Zatwierdzone sesje inwentaryzacji. Kliknij w pozycję, aby wejść w
            szczegóły.
          </p>
        </div>

        <BackButton className="px-3 py-2 rounded border border-border bg-card hover:bg-card/80 text-xs transition" />
      </div>

      {/* META BAR */}
      <div className="rounded-2xl border border-border bg-card p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatPill label="Status" value="Zatwierdzone" />
            <StatPill label="Wyniki" value={rowsWithCounts.length} />
            <StatPill label="Limit" value="200" />
          </div>

          {activeFilters.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs opacity-70">Filtry:</span>
              {activeFilters.map((t) => (
                <FilterPill key={t}>{t}</FilterPill>
              ))}
            </div>
          ) : (
            <div className="text-xs opacity-70">Brak aktywnych filtrów.</div>
          )}
        </div>
      </div>

      {/* FILTRY */}
      <InventoryReportsFilters
        initialFrom={from ?? ""}
        initialTo={to ?? ""}
        initialQ={q ?? ""}
      />

      {/* EMPTY */}
      {rowsWithCounts.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex flex-col items-center justify-center text-center gap-2 py-6">
            <div className="text-sm font-medium">Brak wyników</div>
            <div className="text-xs opacity-70 max-w-lg">
              Zmień zakres dat albo wpisz inną frazę. Jeśli jeszcze nie
              zatwierdziłeś żadnej inwentaryzacji — wróć do draftów i ją przyjmij.
            </div>
            <div className="pt-2">
              <Link
                href="/inventory"
                className="rounded-xl border border-border bg-foreground px-4 py-2 text-sm text-background hover:bg-foreground/90 transition"
              >
                Przejdź do draftów →
              </Link>
            </div>
          </div>
        </div>
      ) : (
        /* LISTA (KANON jak deliveries) */
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="space-y-3">
            {rowsWithCounts.map((r) => {
              const who = r.person?.trim() ? r.person : "—";
              const href = `/reports/inventory/${r.id}`;
              const itemsCount = Number(r.items_count ?? 0);

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
                    {/* LEWA: chipy + KTO/KIEDY */}
                    <div className="min-w-0 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <MiniKV label="ID" value={`#${r.id.slice(0, 8)}`} />
                        <span className="inline-flex items-center gap-2">
                          <Tag>STATUS</Tag>
                          <Tag tone="ok">zatwierdzona</Tag>
                        </span>
                        <MiniKV label="POZYCJI" value={itemsCount} />
                      </div>

                      <div className="grid gap-2 md:grid-cols-2">
                        <KV label="KIEDY" value={r.session_date} />
                        <KV label="KTO" value={who} />
                      </div>
                    </div>

                    {/* PRAWA: CTA */}
                    <div className="shrink-0 flex items-center justify-end">
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
    </div>
  );
}
