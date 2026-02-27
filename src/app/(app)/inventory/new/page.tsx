// src/app/(app)/inventory/new/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import BackButton from "@/components/BackButton";
import { supabaseServer } from "@/lib/supabaseServer";
import type { PermissionSnapshot } from "@/lib/permissions";
import {
  deleteInventorySession,
  inventoryAddAllItems,
  inventoryAddItem,
  inventoryRemoveItem,
  inventorySetCountedQty,
  inventorySearchMaterials,
  noopInventoryApprove,
} from "@/app/(app)/inventory/actions";
import { getInventorySessionDetails } from "@/lib/queries/inventory";
import InventoryEditorV2 from "@/components/inventory/InventoryEditorV2";

type SP = Record<string, string | string[] | undefined>;
export const dynamic = "force-dynamic";

function sp1(sp: SP, key: string): string | null {
  const v = sp[key];
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v
  );
}

type UserMeta = {
  full_name?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
};

async function getLoggedUserFullNameOnly() {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user ?? null;
  if (!user) return "Brak imienia i nazwiska";

  // ✅ źródło prawdy: team_members
  const { data: tm } = await supabase
    .from("team_members")
    .select("first_name,last_name")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  const teamFull = [tm?.first_name, tm?.last_name].filter(Boolean).join(" ").trim();
  if (teamFull) return teamFull;

  // fallback: metadata (bez emaila)
  const md = (user.user_metadata ?? {}) as UserMeta;
  const metaFull =
    (md.full_name && md.full_name.trim()) ||
    (md.name && md.name.trim()) ||
    [md.first_name, md.last_name].filter(Boolean).join(" ").trim();

  return metaFull || "Brak imienia i nazwiska";
}

export default async function NewInventorySessionPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const supabase = await supabaseServer();

  // permissions snapshot (DB source of truth)
  const { data, error } = await supabase.rpc("my_permissions_snapshot");
  const snapshot =
    (Array.isArray(data)
      ? (data[0] as PermissionSnapshot)
      : (data as PermissionSnapshot)) ?? null;

  if (!snapshot || error) redirect("/");
  if (snapshot.role === "worker" || snapshot.role === "foreman") redirect("/");

  const sp = await searchParams;
  const session = sp1(sp, "session"); // ?session=<uuid>
  if (!session) redirect("/inventory");

  if (!isUuid(session)) {
    return (
      <div className="mx-auto w-full max-w-4xl">
        <div className="card p-4 text-xs text-muted-foreground">
          Nieprawidłowy parametr sesji.
          <div className="mt-2">
            <Link className="underline" href="/inventory">
              Wróć do listy
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const who = await getLoggedUserFullNameOnly();
  const { meta, items } = await getInventorySessionDetails(session);

  if (!meta) {
    return (
      <div className="mx-auto w-full max-w-4xl">
        <div className="card p-4 text-xs text-muted-foreground">
          Sesja nie istnieje lub nie masz do niej dostępu.
          <div className="mt-2">
            <Link className="underline" href="/inventory">
              Wróć do listy
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const sessionId = meta.session_id;

  async function onDelete() {
    "use server";
    await deleteInventorySession(sessionId);
    redirect("/inventory");
  }

  // ✅ WRAPPERY muszą być SERVER ACTIONS, inaczej Next nie przepuści ich do client component.
  const addAllStrict = async (sid: string) => {
    "use server";
    return await inventoryAddAllItems(sid);
  };

  const addItemStrict = async (sid: string, materialId: string) => {
    "use server";
    const res = await inventoryAddItem(sid, materialId);
    if (!res?.ok) throw new Error("inventory_add_item_failed");
    return { ok: true as const };
  };

  const removeItemStrict = async (sid: string, materialId: string) => {
    "use server";
    const res = await inventoryRemoveItem(sid, materialId);
    if (!res?.ok) throw new Error("inventory_remove_item_failed");
    return { ok: true as const };
  };

  const setQtyStrict = async (sid: string, materialId: string, countedQty: unknown) => {
    "use server";
    const res = await inventorySetCountedQty(sid, materialId, countedQty);
    if (!res?.ok) throw new Error("inventory_set_counted_qty_failed");
    return { ok: true as const };
  };

  const approveNoopStrict = async (_sid: string) => {
    "use server";
    const res = await noopInventoryApprove();
    if (!res?.ok) throw new Error("inventory_approve_noop_failed");
    return { ok: true as const };
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 w-full sm:w-auto">
          <h1 className="text-lg font-semibold">Inwentaryzacja (draft)</h1>

          {/* ✅ kanon jak w podsumowaniu: pełna szerokość na mobile */}
          <div className="mt-3 rounded-2xl border border-border bg-card p-3 sm:p-4 w-full">
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
                <div className="text-xs opacity-60">Kto</div>
                <div className="text-sm font-medium leading-snug break-words">{who}</div>
              </div>

              <div className="grid gap-1 min-w-0">
                <div className="text-xs opacity-60">Status</div>
                <div className="text-sm font-medium">Draft</div>
              </div>
            </div>

            {meta.description ? (
              <div className="mt-3 border-t border-border/70 pt-3">
                <div className="text-xs opacity-60">Opis</div>
                <div className="mt-1 text-sm">{meta.description}</div>
              </div>
            ) : null}
          </div>
        </div>

        {/* ✅ przyciski wyrównane do prawej */}
        <div className="w-full sm:w-auto flex items-center justify-end gap-2">
          <form action={onDelete}>
            <button
              type="submit"
              className="rounded-md border border-red-500/60 bg-red-500/10 px-3 py-2 text-xs text-red-200 hover:bg-red-500/20 active:bg-red-500/25 transition"
            >
              Usuń inwentaryzację
            </button>
          </form>

          <BackButton className="rounded-md border border-border px-3 py-2 text-xs" />
        </div>
      </div>

      {/* Editor */}
      <InventoryEditorV2
        sessionId={sessionId}
        approved={false}
        initialItems={items}
        addAll={addAllStrict}
        addItem={addItemStrict}
        removeItem={removeItemStrict}
        setQty={setQtyStrict}
        approve={approveNoopStrict}
        searchMaterials={inventorySearchMaterials}
      />

      <div className="flex items-center justify-end">
        <Link
          href={`/inventory/${sessionId}/summary`}
          className="rounded-md border border-border bg-foreground text-background px-4 py-2 text-xs font-medium hover:bg-foreground/90 transition"
        >
          Przejdź do podsumowania →
        </Link>
      </div>
    </div>
  );
}