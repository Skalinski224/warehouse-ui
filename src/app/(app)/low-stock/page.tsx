// src/app/(app)/low-stock/page.tsx
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";
import LowStockTabs from "@/components/low-stock/LowStockTabs";
import { PERM } from "@/lib/permissions";

import BackButton from "@/components/BackButton";

import LowStockInboxClient, { type LowStockInboxItem } from "@/app/(app)/low-stock/_components/LowStockInboxClient";

type SnapshotA = { role?: string | null; permissions?: string[] };
type SnapshotRow = { key: string; allowed: boolean };

type Snapshot = {
  role: string | null;
  permSet: Set<string>;
};

async function getSnapshot(): Promise<Snapshot> {
  const sb = await supabaseServer();
  const { data, error } = await sb.rpc("my_permissions_snapshot");
  if (error || !data) return { role: null, permSet: new Set() };

  const obj = Array.isArray(data) ? (data[0] ?? null) : data;
  if (obj && typeof obj === "object") {
    const a = obj as SnapshotA;
    const perms = Array.isArray(a.permissions) ? a.permissions : [];
    const role = typeof a.role === "string" ? a.role : null;
    if (perms.length || role) {
      return { role, permSet: new Set(perms.map((x) => String(x))) };
    }
  }

  if (Array.isArray(data)) {
    const rows = data as any as SnapshotRow[];
    return {
      role: null,
      permSet: new Set(rows.filter((r) => r?.allowed).map((r) => String(r.key)).filter(Boolean)),
    };
  }

  return { role: null, permSet: new Set() };
}

function can(s: Snapshot, key: string) {
  return s.permSet.has(key);
}

function canEnterLowStock(s: Snapshot) {
  const r = (s.role ?? "").toLowerCase();
  if (r === "owner" || r === "manager" || r === "storeman" || r === "foreman") return true;

  if (!s.role && (can(s, PERM.LOW_STOCK_READ) || can(s, PERM.LOW_STOCK_MANAGE))) return true;

  return false;
}

function toNum(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v) || 0;
  return 0;
}

function clampPct(p: number) {
  return Math.max(0, Math.min(100, p));
}

type InboxRow = {
  event_id: string;
  material_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  unit: string;
  base_quantity: number | string;
  current_quantity: number | string;
  stock_pct: number | string;
  inventory_location_label: string | null;
  acknowledged_at: string | null;
};

async function ackLowStock(eventIds: string[]) {
  "use server";

  const ids = (Array.isArray(eventIds) ? eventIds : []).filter((x) => typeof x === "string" && x.trim().length > 0);
  if (ids.length === 0) return;

  const sb = await supabaseServer();
  await sb.rpc("ack_low_stock", { p_event_ids: ids });
}

export default async function Page() {
  const snap = await getSnapshot();

  if (!canEnterLowStock(snap)) {
    redirect("/materials");
  }

  const sb = await supabaseServer();

  const { data, error } = await sb
    .from("v_low_stock_inbox_secure")
    .select(
      "event_id,material_id,title,description,image_url,unit,base_quantity,current_quantity,stock_pct,inventory_location_label,acknowledged_at"
    )
    .order("acknowledged_at", { ascending: true })
    .order("event_id", { ascending: false });

  if (error) {
    return (
      <div className="space-y-6">
        {/* TOP RIGHT: back */}
        <div className="relative h-12">
          <div className="absolute right-0 top-0 h-full flex items-center">
            <BackButton />
          </div>
        </div>

        <header className="space-y-2">
          <div>
            <h1 className="text-2xl font-semibold">Co się kończy – materiały</h1>
            <p className="text-xs opacity-70 mt-1">Lista materiałów, które spadły poniżej ustalonego % stanu bazowego.</p>
          </div>

          {/* ✅ “wskaźniki” POD nagłówkiem, wyśrodkowane */}
          <div className="flex justify-center">
            <LowStockTabs />
          </div>
        </header>

        <p className="text-sm text-red-400">Błąd: {error.message}</p>
      </div>
    );
  }

  const rows = (Array.isArray(data) ? data : []) as InboxRow[];

  const items: LowStockInboxItem[] = rows
    .map((r) => {
      const base = toNum(r.base_quantity);
      const curr = toNum(r.current_quantity);
      const pctRaw = toNum(r.stock_pct);
      const pct = clampPct(Math.round(pctRaw));

      if (!base || base <= 0) return null;

      return {
        event_id: r.event_id,
        material_id: r.material_id,
        title: r.title,
        description: r.description ?? null,
        image_url: r.image_url,
        unit: r.unit,
        base,
        curr,
        pct,
        inventory_location_label: r.inventory_location_label ?? "—",
        acknowledged_at: r.acknowledged_at,
      };
    })
    .filter(Boolean) as LowStockInboxItem[];

  return (
    <div className="space-y-6">
      {/* TOP RIGHT: back */}
      <div className="relative h-12">
        <div className="absolute right-0 top-0 h-full flex items-center">
          <BackButton />
        </div>
      </div>

      <header className="space-y-2">
        <div>
          <h1 className="text-2xl font-semibold">Co się kończy – materiały</h1>
          <p className="text-xs opacity-70 mt-1">Lista materiałów, które spadły poniżej ustalonego % stanu bazowego.</p>
        </div>

        {/* ✅ “wskaźniki” POD nagłówkiem, wyśrodkowane */}
        <div className="flex justify-center">
          <LowStockTabs />
        </div>
      </header>

      <LowStockInboxClient initialItems={items} ackLowStockAction={ackLowStock} />
    </div>
  );
}