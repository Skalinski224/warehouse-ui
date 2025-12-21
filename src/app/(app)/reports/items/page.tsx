// src/app/(app)/reports/items/page.tsx
import Link from "next/link";

import { supabaseServer } from "@/lib/supabaseServer";
import { safeQuery } from "@/lib/safeQuery";
import ItemsReportFilters from "@/app/(app)/reports/items/_components/ItemsReportFilters";
import { getPermissionSnapshot } from "@/lib/currentUser";
import { can, PERM } from "@/lib/permissions";

type SP = Record<string, string | string[] | undefined>;

function sp1(sp: SP, key: string): string | null {
  const v = sp[key];
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

type Row = {
  id: string;
  title: string;
  unit: string | null;
  current_quantity: number | null;
  base_quantity: number | null;
  deleted_at: string | null;
};

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

export default async function ReportsItemsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  // ✅ GATE — worker nie ma dostępu
  const snap = await getPermissionSnapshot();
  if (!can(snap, PERM.REPORTS_ITEMS_READ)) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="text-sm text-foreground/80">Brak dostępu.</div>
      </div>
    );
  }

  const sp = await searchParams;

  const q = (sp1(sp, "q") ?? "").trim();
  const status = (sp1(sp, "status") ?? "active") as "active" | "deleted" | "all";
  const stock = (sp1(sp, "stock") ?? "all") as "in" | "all";

  const supabase = await supabaseServer();

  let query = supabase
    .from("materials")
    .select("id,title,unit,current_quantity,base_quantity,deleted_at")
    .order("title", { ascending: true })
    .limit(500);

  if (q) query = query.ilike("title", `%${q}%`);
  if (status === "active") query = query.is("deleted_at", null);
  if (status === "deleted") query = query.not("deleted_at", "is", null);
  if (stock === "in") query = query.gt("current_quantity", 0);

  const res = await safeQuery(query);
  const rows = (res.data ?? []) as Row[];

  return (
    <div className="space-y-4">
      {/* HEADER (KANON) */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-sm font-medium">Wszystkie materiały</h1>
          <p className="text-xs opacity-70">
            Lista materiałów — aktywne i usunięte. Kliknij w pozycję, aby wejść w szczegóły.
          </p>
        </div>

        <Link
          href="/reports"
          className="px-3 py-2 rounded border border-border bg-card hover:bg-card/80 text-xs transition"
        >
          ← Wróć do raportów
        </Link>
      </div>

      {/* FILTERS */}
      <ItemsReportFilters q={q} status={status} stock={stock} />

      {/* META */}
      <div className="rounded-2xl border border-border bg-card p-3 flex items-center justify-between gap-3">
        <div className="text-xs opacity-70">
          Wyniki: <span className="font-semibold opacity-100">{rows.length}</span>
          <span className="mx-2 opacity-40">•</span>
          Limit: <span className="font-semibold opacity-100">500</span>
        </div>

        <div className="text-[11px] px-2 py-1 rounded bg-background/60 border border-border">
          Lista (kafle)
        </div>
      </div>

      {/* LISTA (KANON: każdy wiersz = karta-guzik) */}
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-4 text-sm opacity-70">
          Brak wyników.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const isDeleted = !!r.deleted_at;
            const pct = stockPct(r.current_quantity, r.base_quantity);

            const statusChip = isDeleted
              ? "bg-red-600/20 text-red-300 border border-red-500/40"
              : "bg-emerald-600/20 text-emerald-300 border border-emerald-500/40";

            const statusText = isDeleted ? "usunięty" : "aktywny";

            const href = `/materials/${r.id}`;

            return (
              <Link
                key={r.id}
                href={href}
                className={[
                  "block rounded-2xl border border-border bg-card px-4 py-3",
                  "transition will-change-transform hover:bg-card/80 hover:border-border/80 active:scale-[0.995]",
                  "focus:outline-none focus:ring-2 focus:ring-foreground/40",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  {/* LEFT */}
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="text-sm font-medium truncate">{r.title}</div>

                      {r.unit ? (
                        <span className="text-[11px] opacity-70 border border-border rounded px-2 py-1 bg-background/40">
                          {r.unit}
                        </span>
                      ) : null}

                      <span className={`text-[10px] px-2 py-0.5 rounded ${statusChip}`}>
                        {statusText}
                      </span>

                      <span className="text-[10px] opacity-70 font-mono underline underline-offset-2">
                        #{r.id.slice(0, 8)}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-3 text-[11px] pt-1">
                      <span className="opacity-75">
                        Aktualnie:{" "}
                        <strong className="opacity-100">{fmtQty(r.current_quantity)}</strong>
                      </span>
                      <span className="opacity-75">
                        Bazowo:{" "}
                        <strong className="opacity-100">{fmtQty(r.base_quantity)}</strong>
                      </span>

                      {pct !== null ? (
                        <span className="opacity-75">
                          Zapasy:{" "}
                          <strong className="opacity-100">
                            {Math.round(pct)}%
                          </strong>
                        </span>
                      ) : (
                        <span className="opacity-60">Zapasy: —</span>
                      )}
                    </div>

                    {/* PROGRES (subtelny, kanoniczny) */}
                    {pct !== null ? (
                      <div className="pt-2">
                        <div className="h-2 w-full rounded-full bg-background/40 border border-border overflow-hidden">
                          <div
                            className="h-full bg-foreground/80"
                            style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
                          />
                        </div>
                        <div className="text-[11px] opacity-60 pt-1">
                          {pct <= 25 ? "Niski stan (≤25%)" : "OK"}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {/* RIGHT */}
                  <div className="shrink-0 flex items-center gap-2">
                    <span className="px-3 py-2 rounded border border-border bg-background text-xs hover:bg-background/80 transition">
                      Szczegóły →
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
