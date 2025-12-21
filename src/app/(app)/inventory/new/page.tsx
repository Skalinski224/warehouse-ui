// src/app/(app)/inventory/new/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";

import { supabaseServer } from "@/lib/supabaseServer";
import type { PermissionSnapshot } from "@/lib/permissions";

import {
  createInventorySession,
  deleteInventorySession,
  inventoryAddAllItems,
  inventoryAddItem,
  inventoryRemoveItem,
  inventorySetCountedQty,
  inventorySearchMaterials,
  noopInventoryApprove,
} from "@/app/(app)/inventory/actions";

import { getInventorySessionDetails } from "@/lib/queries/inventory";
import InventoryEditor from "@/components/inventory/InventoryEditor";

type SP = Record<string, string | string[] | undefined>;

export const dynamic = "force-dynamic";

function sp1(sp: SP, key: string): string | null {
  const v = sp[key];
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
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

  const teamFull = [tm?.first_name, tm?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
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
  const snapshot = (data as PermissionSnapshot | null) ?? null;

  // Worker + foreman: moduł niewidoczny
  if (!snapshot || error) redirect("/");
  if (snapshot.role === "worker" || snapshot.role === "foreman") redirect("/");

  const sp = await searchParams;
  const session = sp1(sp, "session"); // ?session=<uuid>

  const who = await getLoggedUserFullNameOnly();
  const defaultDate = todayISO();

  // 1) start: brak session -> tworzymy
  if (!session) {
    async function onCreate(formData: FormData) {
      "use server";

      const session_date =
        String(formData.get("session_date") ?? "").trim() || null;
      const description =
        String(formData.get("description") ?? "").trim() || null;

      const { sessionId } = await createInventorySession({
        session_date,
        description,
      });

      redirect(`/inventory/new?session=${sessionId}`);
    }

    return (
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">Nowa inwentaryzacja</h1>
            <p className="text-xs text-muted-foreground">
              Utwórz sesję, a potem dodaj materiały i wpisz stany — bez zmiany w
              systemie, dopóki nie zatwierdzisz w podsumowaniu.
            </p>
          </div>

          <Link
            href="/inventory"
            className="rounded-md border border-border px-3 py-2 text-xs"
          >
            ← Wróć
          </Link>
        </div>

        <form action={onCreate} className="card p-4 space-y-3 max-w-3xl">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="space-y-1 block">
              <div className="text-[11px] text-muted-foreground">Data</div>
              <input
                type="date"
                name="session_date"
                defaultValue={defaultDate}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs"
                required
              />
            </label>

            <label className="space-y-1 block">
              <div className="text-[11px] text-muted-foreground">Kto</div>
              <input
                value={who}
                disabled
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs opacity-80"
              />
            </label>
          </div>

          <label className="space-y-1 block">
            <div className="text-[11px] text-muted-foreground">
              Opis (opcjonalnie)
            </div>
            <textarea
              name="description"
              rows={3}
              placeholder="Np. Inwentaryzacja po dostawie / przed końcem tygodnia…"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs"
            />
          </label>

          <div className="flex items-center justify-end gap-2 pt-1">
            <Link
              href="/inventory"
              className="rounded-md border border-border px-3 py-2 text-xs"
            >
              Anuluj
            </Link>

            <button
              type="submit"
              className="rounded-md border border-border bg-card px-3 py-2 text-xs font-medium"
            >
              Utwórz sesję i przejdź dalej
            </button>
          </div>
        </form>
      </div>
    );
  }

  // 2) edycja: session musi być uuid
  if (!isUuid(session)) {
    return (
      <div className="card p-4 text-xs text-muted-foreground">
        Nieprawidłowy parametr sesji.
        <div className="mt-2">
          <Link className="underline" href="/inventory">
            Wróć do listy
          </Link>
        </div>
      </div>
    );
  }

  const { meta, items } = await getInventorySessionDetails(session);
  if (!meta) {
    return (
      <div className="card p-4 text-xs text-muted-foreground">
        Sesja nie istnieje lub nie masz do niej dostępu.
        <div className="mt-2">
          <Link className="underline" href="/inventory">
            Wróć do listy
          </Link>
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-lg font-semibold">Inwentaryzacja (draft)</h1>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-md border border-border px-3 py-2">
              Data:{" "}
              <span className="text-muted-foreground">{meta.session_date}</span>
            </span>

            <span className="rounded-md border border-border px-3 py-2">
              Kto: <span className="text-muted-foreground">{who}</span>
            </span>

            <span className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">
              Draft
            </span>
          </div>

          <p className="text-xs text-muted-foreground">{meta.description || "—"}</p>
        </div>

        <div className="flex items-center gap-2">
          <form action={onDelete}>
            <button
              type="submit"
              className="rounded-md border border-red-500/60 bg-red-500/10 px-3 py-2 text-xs text-red-200 hover:bg-red-500/20"
            >
              Usuń inwentaryzację
            </button>
          </form>

          <Link
            href="/inventory"
            className="rounded-md border border-border px-3 py-2 text-xs"
          >
            ← Wróć
          </Link>
        </div>
      </div>

      {/* Editor */}
      <InventoryEditor
        sessionId={sessionId}
        approved={false}
        initialItems={items}
        addAll={inventoryAddAllItems}
        addItem={inventoryAddItem}
        removeItem={inventoryRemoveItem}
        setQty={inventorySetCountedQty}
        // ⛔ nie zatwierdzamy tutaj
        approve={noopInventoryApprove}
        // ✅ server action (bez inline async)
        searchMaterials={inventorySearchMaterials}
      />

      <div className="flex items-center justify-end">
        <Link
          href={`/inventory/${sessionId}/summary`}
          className="rounded-md border border-border bg-card px-3 py-2 text-xs font-medium"
        >
          Przejdź do podsumowania →
        </Link>
      </div>
    </div>
  );
}
