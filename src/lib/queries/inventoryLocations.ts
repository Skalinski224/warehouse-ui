// src/lib/queries/inventoryLocations.ts
import { supabaseServer } from "@/lib/supabaseServer";
import { PERM, can } from "@/lib/permissions";

export type LocationRow = { id: string; label: string; deleted_at?: string | null };

type Options = {
  includeDeleted?: boolean;      // pokaż też usunięte lokalizacje
  onlyWithMaterials?: boolean;   // pokaż tylko takie, które mają materiały (aktywnie)
};

async function getSnapshot() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("my_permissions_snapshot");
  if (error) return null;
  return Array.isArray(data) ? (data[0] ?? null) : (data ?? null);
}

function looksLikeMissingColumn(err: any): boolean {
  const code = String(err?.code || "");
  const msg = String(err?.message || "");
  return (
    code === "42703" ||
    /column .* does not exist/i.test(msg) ||
    /schema cache/i.test(msg) ||
    /could not find/i.test(msg)
  );
}

export async function fetchInventoryLocations(opts: Options = {}): Promise<LocationRow[]> {
  const snapshot = await getSnapshot();
  if (!can(snapshot, PERM.MATERIALS_READ)) return [];

  const includeDeleted = Boolean(opts.includeDeleted);
  const onlyWithMaterials = opts.onlyWithMaterials !== false; // default true

  const supabase = await supabaseServer();

  // 1) jeśli chcemy tylko lokacje z materiałami → pobierz listę ID z materials
  let allowedIds: string[] | null = null;
  if (onlyWithMaterials) {
    const { data: mats, error: matsErr } = await supabase
      .from("materials")
      .select("inventory_location_id")
      .is("deleted_at", null)
      .not("inventory_location_id", "is", null)
      .limit(5000);

    if (!matsErr) {
      const set = new Set<string>();
      for (const r of mats ?? []) {
        const id = String((r as any)?.inventory_location_id ?? "").trim();
        if (id) set.add(id);
      }
      allowedIds = Array.from(set);
      // jeśli nie ma żadnych materiałów → nie ma sensu ciągnąć lokacji
      if (allowedIds.length === 0) return [];
    }
  }

  // 2) pobierz lokacje (spróbuj z deleted_at; jeśli kolumny nie ma — fallback)
  async function run(selectStr: string) {
    let q = supabase.from("inventory_locations").select(selectStr).order("label", { ascending: true });

    if (!includeDeleted) {
      // preferujemy soft-delete kolumną deleted_at
      q = q.is("deleted_at", null);
    }

    if (allowedIds && allowedIds.length > 0) {
      q = q.in("id", allowedIds);
    }

    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as any[];
  }

  let rows: any[] = [];
  try {
    rows = await run("id,label,deleted_at");
  } catch (e: any) {
    if (!looksLikeMissingColumn(e)) {
      console.error("fetchInventoryLocations error:", e?.message ?? e);
      return [];
    }

    // fallback dla starego schematu bez deleted_at
    try {
      rows = await run("id,label");
    } catch (e2: any) {
      console.error("fetchInventoryLocations fallback error:", e2?.message ?? e2);
      return [];
    }
  }

  // 3) dedupe po id (na wypadek joinów / dziwnych danych)
  const map = new Map<string, LocationRow>();
  for (const r of rows) {
    const id = String(r?.id ?? "").trim();
    if (!id) continue;
    if (!map.has(id)) {
      map.set(id, {
        id,
        label: String(r?.label ?? "").trim() || "—",
        deleted_at: (r as any)?.deleted_at ?? null,
      });
    }
  }

  return Array.from(map.values());
}
