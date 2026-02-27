// src/app/(app)/reports/transfers/page.tsx
import { supabaseServer } from "@/lib/supabaseServer";
import { getTransferReportsDayLive } from "@/lib/queries/transferReports";

import TransferReportsClient, {
  type TransferDayRow,
} from "@/app/(app)/reports/transfers/_components/TransferReportsClient";

export const dynamic = "force-dynamic";

export default async function TransferReportsPage() {
  // ✅ najpierw ustaw kontekst (auth + current_account_id)
  const sb = await supabaseServer();

  // ✅ potem query
  const rawRows = (await getTransferReportsDayLive()) as any[] | null;

  const rowsBase: Array<{
    day: string;
    created_by: string | null;

    created_by_name?: string | null;
    created_by_email?: string | null;

    from_location_id: string | null;
    to_location_id: string | null;
    transfers_count: number | string | null;
    qty_total: number | string | null;
    last_at: string | null;
  }> = (rawRows ?? []) as any;

  // map location_id -> label
  const locIds = Array.from(
    new Set(
      rowsBase
        .flatMap((r) => [r.from_location_id, r.to_location_id])
        .filter(Boolean)
        .map((x) => String(x))
    )
  );

  const locMap = new Map<string, string>();
  if (locIds.length) {
    const { data } = await sb.from("inventory_locations").select("id,label").in("id", locIds);
    for (const x of data ?? []) locMap.set(String((x as any).id), String((x as any).label));
  }

  const rows: TransferDayRow[] = rowsBase.map((r) => ({
    day: String(r.day),
    created_by: r.created_by ? String(r.created_by) : null,

    created_by_name: (r.created_by_name ?? null) as any,
    created_by_email: (r.created_by_email ?? null) as any,

    from_location_id: r.from_location_id ? String(r.from_location_id) : null,
    to_location_id: r.to_location_id ? String(r.to_location_id) : null,

    from_location_label: r.from_location_id ? locMap.get(String(r.from_location_id)) ?? null : null,
    to_location_label: r.to_location_id ? locMap.get(String(r.to_location_id)) ?? null : null,

    transfers_count: r.transfers_count ?? null,
    qty_total: r.qty_total ?? null,
    last_at: r.last_at ? String(r.last_at) : null,
  }));

  const locations = Array.from(locMap.entries())
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "pl"));

  return (
    <main className="space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-base font-semibold leading-tight">Transfery</h1>
          <p className="text-xs opacity-70 mt-1">
            Raport transferów magazynowych (pogrupowane po{" "}
            <span className="font-medium">dniu, osobie i trasie</span>). Filtry działają na żywo —
            kliknij w wiersz, aby zobaczyć szczegóły.
          </p>
        </div>
      </header>

      <TransferReportsClient rows={rows} locations={locations} />
    </main>
  );
}