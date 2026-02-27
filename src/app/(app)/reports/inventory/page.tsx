// src/app/(app)/reports/inventory/page.tsx
import { getInventorySessions } from "@/lib/queries/inventory";
import { getPermissionSnapshot } from "@/lib/currentUser";
import { can, PERM } from "@/lib/permissions";

import InventoryReportsClient, {
  type InventoryReportRow,
} from "@/app/(app)/reports/inventory/_components/InventoryReportsClient";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;

function sp1(sp: SP, key: string): string {
  const v = sp[key];
  if (!v) return "";
  return Array.isArray(v) ? v[0] ?? "" : v;
}

export default async function ReportsInventoryPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  // ✅ Gate: raporty — tylko przez permission
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

  const from = sp1(sp, "from") || "";
  const to = sp1(sp, "to") || "";
  const q = sp1(sp, "q") || "";

  // ✅ KLUCZ: bierzemy error z backendu
  const { rows, error } = await getInventorySessions({
    gate: "reports",
    approved: true,
    include_deleted: false,
    from: from || null,
    to: to || null,
    q: q || null,
    limit: 200,
    offset: 0,
  });

  const safeRows: InventoryReportRow[] = (rows ?? []).map((r: any) => ({
    id: String(r.id),
    account_id: r.account_id ? String(r.account_id) : null,

    person: r.person ?? null,
    session_date: r.session_date ? String(r.session_date) : null,

    inventory_location_label: r.inventory_location_label ?? null,
    description: r.description ?? null,

    items_count: r.items_count ?? null,
  }));

  return (
    <main className="space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-base font-semibold leading-tight">Inwentaryzacje</h1>
          <p className="text-xs opacity-70 mt-1">
            Raport zatwierdzonych sesji inwentaryzacji (max 200). Filtry działają na żywo — kliknij w
            wiersz, aby zobaczyć szczegóły.
          </p>
        </div>
      </header>

      <InventoryReportsClient
        rows={safeRows}
        error={error ?? null}
        initialFrom={from}
        initialTo={to}
        initialQ={q}
      />
    </main>
  );
}