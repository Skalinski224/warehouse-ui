// src/lib/queries/materialsChanges.ts
import { supabaseServer } from "@/lib/supabaseServer";
import { getPermissionSnapshot } from "@/lib/currentUser";
import { PERM, can } from "@/lib/permissions";

export type MaterialsChangeRow = {
  id: string;
  material_id: string;
  changed_by: string | null;
  changed_at: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  material_title: string | null;
  changed_by_name: string | null;
};

export type MaterialsChangeAction = {
  /** id jednego z rekordów w batchu – używamy jako “klucz” do szczegółów */
  id: string;
  material_id: string;
  changed_by: string | null;
  changed_at: string;
  material_title: string | null;
  changed_by_name: string | null;
  fields: string[]; // np. ["title","description","base_quantity"]
};

type SortDir = "asc" | "desc";

const AUDIT_READ =
  (PERM as any).MATERIALS_AUDIT_READ ??
  (PERM as any).MATERIALS_CHANGES_READ ??
  "materials.audit.read";

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

function groupKey(r: { material_id: string; changed_by: string | null; changed_at: string }) {
  return `${r.material_id}__${r.changed_by ?? "null"}__${r.changed_at}`;
}

async function canReadAudit(): Promise<boolean> {
  const snap = await getPermissionSnapshot();

  const role = (snap as any)?.role;
  if (role === "owner" || role === "manager") return true;

  try {
    if (can(snap as any, AUDIT_READ as any)) return true;
  } catch {}

  // DB fallback
  const sb = await supabaseServer();
  const tries: Array<Record<string, any>> = [{ p_key: String(AUDIT_READ) }, { key: String(AUDIT_READ) }];
  for (const args of tries) {
    const { data, error } = await sb.rpc("has_permission", args as any);
    if (!error) return !!data;
  }
  return false;
}

/**
 * LISTA — zwraca “akcje” (batch), NIE pojedyncze pola.
 * Żeby paginacja była po akcjach, robimy:
 *  - pobranie większej paczki raw rekordów
 *  - grupowanie w TS
 *  - slice po grupach (page/limit)
 *
 * To jest pragmatyczne i działa dobrze przy normalnych wolumenach.
 */
export async function fetchMaterialsChangesList(params: {
  q: string | null;
  from: string | null; // YYYY-MM-DD
  to: string | null; // YYYY-MM-DD
  limit: number; // ile AKCJI na stronę
  offset: number; // offset AKCJI
  dir?: SortDir; // default desc
}): Promise<{ rows: MaterialsChangeAction[]; canRead: boolean }> {
  const ok = await canReadAudit();
  if (!ok) return { rows: [], canRead: false };

  const supabase = await supabaseServer();

  // ile raw rekordów pobieramy “na zapas” żeby złożyć grupy
  const dir = params.dir ?? "desc";
  const needGroups = params.offset + params.limit;
  const rawTake = Math.min(2000, Math.max(300, needGroups * 6)); // 6 pól na akcję to typowy sufit

  let query = supabase
    .from("materials_changes")
    .select(
      `
      id,
      material_id,
      changed_by,
      changed_at,
      field,
      old_value,
      new_value,
      materials:materials ( title )
    `
    );

  // zakres dat
  if (params.from) query = query.gte("changed_at", `${params.from}T00:00:00.000Z`);
  if (params.to) query = query.lte("changed_at", `${params.to}T23:59:59.999Z`);

  // sort
  query = query.order("changed_at", { ascending: dir === "asc" });

  // pobieramy od góry (bez offsetu), bo offset robimy po grupach
  query = query.range(0, rawTake - 1);

  const { data, error } = await query;
  if (error) {
    console.error("[fetchMaterialsChangesList] error:", error);
    return { rows: [], canRead: true };
  }

  const raw = (data ?? []).map((r: any) => ({
    id: r.id,
    material_id: r.material_id,
    changed_by: r.changed_by ?? null,
    changed_at: r.changed_at,
    field: r.field,
    old_value: r.old_value ?? null,
    new_value: r.new_value ?? null,
    material_title: r?.materials?.title ?? null,
    changed_by_name: null,
  })) as MaterialsChangeRow[];

  // dołączamy imię i nazwisko po team_members.user_id
  const userIds = uniq(raw.map((x) => x.changed_by).filter(Boolean) as string[]);
  const nameByUserId = new Map<string, string>();

  if (userIds.length) {
    const { data: tm, error: tmErr } = await supabase
      .from("team_members")
      .select("user_id, first_name, last_name")
      .in("user_id", userIds)
      .is("deleted_at", null);

    if (!tmErr && tm) {
      for (const m of tm as any[]) {
        const uid = m.user_id as string | null;
        if (!uid) continue;
        const fn = String(m.first_name ?? "").trim();
        const ln = String(m.last_name ?? "").trim();
        nameByUserId.set(uid, ([fn, ln].filter(Boolean).join(" ").trim() || "—"));
      }
    }
  }

  for (const r of raw) {
    r.changed_by_name = r.changed_by ? nameByUserId.get(r.changed_by) ?? "—" : "—";
  }

  // live search po tym co widać + polach (ale wynik i tak grupujemy)
  const q = (params.q ?? "").trim().toLowerCase();
  const filtered =
    q.length === 0
      ? raw
      : raw.filter((r) => {
          const hay = [
            r.material_title ?? "",
            r.changed_by_name ?? "",
            r.changed_at ?? "",
            r.field ?? "",
            r.old_value ?? "",
            r.new_value ?? "",
          ]
            .join(" | ")
            .toLowerCase();
          return hay.includes(q);
        });

  // grupowanie w “akcje”
  const byKey = new Map<string, MaterialsChangeAction>();

  for (const r of filtered) {
    const k = groupKey(r);
    const g = byKey.get(k);

    if (!g) {
      byKey.set(k, {
        id: r.id, // pierwszy id jako anchor do szczegółów
        material_id: r.material_id,
        changed_by: r.changed_by,
        changed_at: r.changed_at,
        material_title: r.material_title,
        changed_by_name: r.changed_by_name,
        fields: [r.field],
      });
    } else {
      if (!g.fields.includes(r.field)) g.fields.push(r.field);

      // jeżeli pierwsza pozycja nie miała title (rzadkie) to uzupełnij
      if (!g.material_title && r.material_title) g.material_title = r.material_title;

      // anchor id trzymamy najwcześniejszy alfabetycznie – stabilniej
      if (String(r.id) < String(g.id)) g.id = r.id;
    }
  }

  // sort po changed_at desc/asc (Map zachowuje kolejność insertion, więc sortujemy jawnie)
  const actions = Array.from(byKey.values()).sort((a, b) => {
    if (a.changed_at === b.changed_at) return String(a.id).localeCompare(String(b.id));
    return dir === "asc"
      ? String(a.changed_at).localeCompare(String(b.changed_at))
      : String(b.changed_at).localeCompare(String(a.changed_at));
  });

  const pageSlice = actions.slice(params.offset, params.offset + params.limit);

  return { rows: pageSlice, canRead: true };
}

export async function fetchMaterialsChangeDetails(id: string): Promise<{
  canRead: boolean;
  row: MaterialsChangeRow | null;
  batch: MaterialsChangeRow[];
}> {
  const ok = await canReadAudit();
  if (!ok) return { canRead: false, row: null, batch: [] };

  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from("materials_changes")
    .select(
      `
      id,
      material_id,
      changed_by,
      changed_at,
      field,
      old_value,
      new_value,
      materials:materials ( title )
    `
    )
    .eq("id", id)
    .limit(1);

  if (error || !data?.[0]) {
    if (error) console.error("[fetchMaterialsChangeDetails] error:", error);
    return { canRead: true, row: null, batch: [] };
  }

  const r: any = data[0];

  let name = "—";
  if (r.changed_by) {
    const { data: tm } = await supabase
      .from("team_members")
      .select("first_name, last_name")
      .eq("user_id", r.changed_by)
      .is("deleted_at", null)
      .limit(1);

    const m = tm?.[0] as any;
    const fn = String(m?.first_name ?? "").trim();
    const ln = String(m?.last_name ?? "").trim();
    name = [fn, ln].filter(Boolean).join(" ").trim() || "—";
  }

  const row: MaterialsChangeRow = {
    id: r.id,
    material_id: r.material_id,
    changed_by: r.changed_by ?? null,
    changed_at: r.changed_at,
    field: r.field,
    old_value: r.old_value ?? null,
    new_value: r.new_value ?? null,
    material_title: r?.materials?.title ?? null,
    changed_by_name: name,
  };

  // batch = wszystko z tej samej akcji (material_id + changed_at + changed_by)
  let batchQuery = supabase
    .from("materials_changes")
    .select(
      `
      id,
      material_id,
      changed_by,
      changed_at,
      field,
      old_value,
      new_value,
      materials:materials ( title )
    `
    )
    .eq("material_id", row.material_id)
    .eq("changed_at", row.changed_at);

  if (row.changed_by) batchQuery = batchQuery.eq("changed_by", row.changed_by);

  const { data: batchData, error: bErr } = await batchQuery.order("field", { ascending: true });
  if (bErr) console.error("[fetchMaterialsChangeDetails.batch] error:", bErr);

  const batch = (batchData ?? []).map((x: any) => ({
    id: x.id,
    material_id: x.material_id,
    changed_by: x.changed_by ?? null,
    changed_at: x.changed_at,
    field: x.field,
    old_value: x.old_value ?? null,
    new_value: x.new_value ?? null,
    material_title: row.material_title ?? x?.materials?.title ?? null,
    changed_by_name: name,
  })) as MaterialsChangeRow[];

  return { canRead: true, row, batch };
}
