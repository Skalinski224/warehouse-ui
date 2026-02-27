// src/lib/queries/inventoryShrinkSeries.ts
import { supabaseServer } from "@/lib/supabaseServer";
import { PERM, can } from "@/lib/permissions";

export type InventoryShrinkPoint = {
  bucket: string; // YYYY-MM-DD
  shrink_value_est: number | null; // null = brak słupka
};

function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toISO10(v: unknown): string {
  const s = String(v ?? "");
  return s ? s.slice(0, 10) : "";
}

async function getSnapshot() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("my_permissions_snapshot");
  if (error) return null;
  return Array.isArray(data) ? (data[0] ?? null) : (data ?? null);
}

export async function getInventoryShrinkSeries(input: {
  from: string;
  to: string;
  inventory_location_id?: string | null;
  // zostawiamy w typie, ale świadomie NIE używamy (interwał robimy w UI)
  granularity?: "day" | "week" | "month";
}): Promise<InventoryShrinkPoint[]> {
  const snapshot = await getSnapshot();
  if (!can(snapshot, PERM.MATERIALS_READ)) return [];

  const sb = await supabaseServer();

  // ✅ ZAWSZE pobieramy dziennie, żeby UI mogło agregować dzień/tydzień/miesiąc
  const { data, error } = await sb.rpc("inventory_shrink_series", {
    p_from: input.from,
    p_to: input.to,
    p_inventory_location_id: input.inventory_location_id ?? null,
    p_granularity: "day",
  });

  if (error || !Array.isArray(data)) return [];

  return (data as any[])
    .map((r: any) => ({
      bucket: toISO10(r?.bucket ?? r?.day ?? ""),
      shrink_value_est: toNum(r?.shrink_value_est),
    }))
    .filter((x) => x.bucket);
}