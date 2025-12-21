// src/app/(app)/low-stock/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";
import LowStockTabs from "@/components/low-stock/LowStockTabs";
import { PERM } from "@/lib/permissions";

type Row = {
  id: string;
  title: string;
  description?: string | null;
  image_url: string | null;
  unit: string;
  base_quantity: number | string;
  current_quantity: number | string;
  stock_pct: number | string;
  deleted_at: string | null;
};

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

  // ✅ Format A: { role, permissions } lub [ { role, permissions } ]
  const obj = Array.isArray(data) ? (data[0] ?? null) : data;
  if (obj && typeof obj === "object") {
    const a = obj as SnapshotA;
    const perms = Array.isArray(a.permissions) ? a.permissions : [];
    const role = typeof a.role === "string" ? a.role : null;
    if (perms.length || role) {
      return { role, permSet: new Set(perms.map((x) => String(x))) };
    }
  }

  // ✅ Format B: [{ key, allowed }]
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

// ✅ gate wejścia: tylko owner/manager/storeman/foreman
function canEnterLowStock(s: Snapshot) {
  const r = (s.role ?? "").toLowerCase();
  if (r === "owner" || r === "manager" || r === "storeman" || r === "foreman") return true;

  // fallback gdy snapshot nie zwraca roli:
  // wpuszczamy jeśli ma low_stock perms (read/manage)
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

export default async function Page() {
  const snap = await getSnapshot();

  // ✅ gate wejścia do zakładki
  if (!canEnterLowStock(snap)) {
    redirect("/materials");
  }

  const supabase = await supabaseServer();

  // bierzemy też description — jeśli view nie ma tej kolumny, fallback poniżej zadziała
  const { data, error } = await supabase
    .from("v_materials_overview")
    .select("id,title,description,image_url,unit,base_quantity,current_quantity,stock_pct,deleted_at")
    .lte("stock_pct", 25)
    .is("deleted_at", null)
    .order("stock_pct", { ascending: true });

  // jeżeli view nie ma description → powtórz bez niej (żeby nie crashowało)
  const missingDescription =
    error?.message?.toLowerCase?.().includes("column") &&
    error.message.toLowerCase().includes("description");

  if (error && !missingDescription) {
    return (
      <div className="p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Co się kończy</h1>
          <LowStockTabs />
        </div>
        <p className="text-sm text-red-400">Błąd: {error.message}</p>
      </div>
    );
  }

  const { data: data2, error: error2 } = missingDescription
    ? await supabase
        .from("v_materials_overview")
        .select("id,title,image_url,unit,base_quantity,current_quantity,stock_pct,deleted_at")
        .lte("stock_pct", 25)
        .is("deleted_at", null)
        .order("stock_pct", { ascending: true })
    : { data, error: null as any };

  if (error2) {
    return (
      <div className="p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Co się kończy</h1>
          <LowStockTabs />
        </div>
        <p className="text-sm text-red-400">Błąd: {error2.message}</p>
      </div>
    );
  }

  const items = (data2 ?? [])
    .map((r: Row) => {
      const base = toNum(r.base_quantity);
      const curr = toNum(r.current_quantity);
      const pctRaw = toNum(r.stock_pct);
      const pct = clampPct(Math.round(pctRaw));

      if (!base || base <= 0) return null;

      return {
        id: r.id,
        title: r.title,
        description: (r as any).description ?? null,
        image_url: r.image_url,
        unit: r.unit,
        base,
        curr,
        pct,
      };
    })
    .filter(Boolean) as {
    id: string;
    title: string;
    description: string | null;
    image_url: string | null;
    unit: string;
    base: number;
    curr: number;
    pct: number;
  }[];

  return (
    <div className="p-6 space-y-8">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Co się kończy – materiały</h1>
          <p className="text-xs opacity-70 mt-1">
            Lista materiałów, które spadły poniżej ustalonego % stanu bazowego.
          </p>
        </div>
        <LowStockTabs />
      </header>

      <section className="space-y-4">
        {items.length === 0 ? (
          <p className="text-sm opacity-70">Obecnie żadna pozycja nie spadła poniżej ustalonego stanu bazowego.</p>
        ) : (
          // ✅ 3 ekrany: telefon / tablet / desktop
          <ul className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {items.map((m) => {
              const pctSafe = clampPct(m.pct);

              return (
                <li key={m.id} className="rounded-2xl border border-border bg-card overflow-hidden">
                  {/* ✅ karta identyczna jak katalog: miniatura lewa + treść prawa */}
                  <Link href={`/materials/${m.id}`} className="block hover:bg-background/10 transition">
                    <div className="p-4">
                      <div className="flex gap-4">
                        {/* Miniatura */}
                        <div className="w-28 h-28 rounded-xl overflow-hidden bg-background/50 border border-border flex-shrink-0 relative">
                          {m.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={m.image_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-xs opacity-60">
                              brak zdjęcia
                            </div>
                          )}
                        </div>

                        {/* Treść */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-semibold truncate">{m.title}</div>
                              {/* opis jak w katalogu (jeśli istnieje) */}
                              <div className="mt-1 text-xs opacity-70 line-clamp-2">
                                {m.description ? m.description : "—"}
                              </div>
                            </div>

                            <span className="text-[11px] px-2 py-1 rounded bg-background/60 border border-border flex-shrink-0">
                              {m.unit}
                            </span>
                          </div>

                          <div className="mt-3 text-sm opacity-90">
                            {m.curr} / {m.base} {m.unit} ({pctSafe}%)
                          </div>

                          <div className="mt-2 h-2 rounded bg-background/60 overflow-hidden">
                            <div
                              className={`h-full ${pctSafe <= 25 ? "bg-red-500/70" : "bg-foreground/70"}`}
                              style={{ width: `${pctSafe}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
