// src/components/inventory/InventoryEditorV2.tsx
"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type MaterialSearchRow = {
  id: string;
  title: string;
  unit: string | null;
};

type InventoryItemRow = {
  item_id: string;
  material_id: string;
  material_title: string;
  material_unit: string | null;
  material_image_url: string | null;
  system_qty: number;
  counted_qty: number | null;
  diff_qty: number | null;
  note: string | null;
};

function normalizeDecimalInput(raw: string) {
  const s = String(raw ?? "");
  const cleaned = s.replace(/[^\d.,-]/g, "");
  const firstSep = cleaned.search(/[.,]/);
  if (firstSep === -1) return cleaned;

  const head = cleaned.slice(0, firstSep + 1);
  const tail = cleaned
    .slice(firstSep + 1)
    .replace(/[.,]/g, "")
    .replace(/-/g, "");
  const minus = head.startsWith("-") ? "-" : "";
  const headNoMinus = head.replace(/-/g, "");
  return minus + headNoMinus + tail;
}

function toNumOrNull(v: string): number | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s.replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return n;
}

function diffBadgeClasses(diff: number | null) {
  if (diff === null) return "border-border text-muted-foreground bg-background/10";
  if (diff === 0) return "border-border text-muted-foreground bg-background/10";
  if (diff > 0) return "border-emerald-500/40 text-emerald-300 bg-emerald-500/10";
  return "border-red-500/40 text-red-300 bg-red-500/10";
}

export default function InventoryEditorV2(props: {
  sessionId: string;
  approved: boolean;
  initialItems: InventoryItemRow[];

  addAll: (sessionId: string) => Promise<{ inserted: number }>;
  addItem: (sessionId: string, materialId: string) => Promise<{ ok: true }>;
  removeItem: (sessionId: string, materialId: string) => Promise<{ ok: true }>;
  setQty: (sessionId: string, materialId: string, countedQty: unknown) => Promise<{ ok: true }>;

  approve: (sessionId: string) => Promise<{ ok: true }>;
  searchMaterials: (sessionId: string, q: string) => Promise<{ rows: MaterialSearchRow[] }>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [items, setItems] = useState<InventoryItemRow[]>(props.initialItems ?? []);

  // ✅ trzymamy się w sync z serwerem (router.refresh())
  useEffect(() => {
    setItems(props.initialItems ?? []);
  }, [props.initialItems]);

  // search
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<MaterialSearchRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // inline qty drafts (żeby nie „skakało” przy wpisywaniu)
  const qtyDraft = useMemo(() => {
    const map = new Map<string, string>();
    for (const it of items) {
      map.set(it.material_id, it.counted_qty === null ? "" : String(it.counted_qty));
    }
    return map;
  }, [items]);

  const [qtyInput, setQtyInput] = useState<Record<string, string>>({});

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const [k, v] of qtyDraft.entries()) next[k] = v;
    setQtyInput(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.sessionId]); // reset po zmianie sesji

  useEffect(() => {
    if (!okMsg) return;
    const t = setTimeout(() => setOkMsg(null), 4000);
    return () => clearTimeout(t);
  }, [okMsg]);

  useEffect(() => {
    const needle = q.trim();

    if (!needle) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const res = await props.searchMaterials(props.sessionId, needle);
        setResults(res.rows ?? []);
      } catch (e: any) {
        setErr(e?.message ?? "Nie udało się wyszukać materiałów.");
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, props.sessionId]);

  function refreshSoft() {
    startTransition(() => {
      router.refresh();
    });
  }

  async function handleAddAll() {
    setErr(null);
    setOkMsg(null);

    try {
      const res = await props.addAll(props.sessionId);
      setOkMsg(`Dodano: ${res.inserted}`);
      refreshSoft();
    } catch (e: any) {
      setErr(e?.message ?? "Nie udało się dodać pozycji.");
    }
  }

  async function handleAddOne(m: MaterialSearchRow) {
    setErr(null);
    setOkMsg(null);

    try {
      await props.addItem(props.sessionId, m.id);
      setOkMsg("Dodano materiał do sesji.");
      setQ("");
      setResults([]);
      refreshSoft();
    } catch (e: any) {
      setErr(e?.message ?? "Nie udało się dodać materiału.");
    }
  }

  async function handleRemove(materialId: string) {
    setErr(null);
    setOkMsg(null);

    try {
      await props.removeItem(props.sessionId, materialId);
      setOkMsg("Usunięto pozycję.");
      refreshSoft();
    } catch (e: any) {
      setErr(e?.message ?? "Nie udało się usunąć pozycji.");
    }
  }

  async function handleSetQty(materialId: string, raw: string) {
    setErr(null);
    setOkMsg(null);

    const normalized = normalizeDecimalInput(raw);
    setQtyInput((prev) => ({ ...prev, [materialId]: normalized }));

    const n = toNumOrNull(normalized);

    try {
      await props.setQty(props.sessionId, materialId, n);
      refreshSoft();
    } catch (e: any) {
      setErr(e?.message ?? "Nie udało się zapisać ilości.");
    }
  }

  const itemsCount = items.length;

  const inputBase = "h-10 border border-border bg-background rounded px-2 text-xs w-full";
  // ✅ read-only: lekko przygaszone
  const inputReadOnly =
    "h-10 border border-border bg-background/10 rounded px-2 text-xs w-full flex items-center text-muted-foreground";
  const labelBase = "text-[11px] text-muted-foreground";
  const dangerBtn =
    "rounded-md border border-red-500/60 bg-red-500/10 px-3 py-1.5 text-[11px] text-red-200 hover:bg-red-500/20 active:bg-red-500/25 transition";

  return (
    <div className="space-y-4">
      {/* Top actions */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Pozycje sesji</div>
            <div className="text-xs opacity-70">
              Dodawaj materiały i wpisuj faktyczne ilości. Zmiany w stanach dopiero po zatwierdzeniu
              w podsumowaniu.
            </div>
          </div>

          {/* ✅ po prawej, bez pełnej szerokości */}
          <div className="flex items-center justify-end gap-2">
            <span className="text-[11px] px-2 py-1 rounded bg-background/60 border border-border">
              Pozycje: <span className="font-semibold">{itemsCount}</span>
            </span>

            <button
              type="button"
              onClick={handleAddAll}
              disabled={isPending}
              className="rounded-md border border-border bg-background px-3 py-2 text-xs hover:bg-foreground/5 transition disabled:opacity-60"
              title="Doda wszystkie aktywne materiały z lokalizacji tej sesji"
            >
              + Dodaj wszystkie
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="grid gap-2">
          <label className="text-sm">Szukaj materiału</label>
          <input
            type="text"
            placeholder="Wpisz nazwę…"
            className="h-10 border border-border bg-background rounded px-3 text-sm w-full"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <div className="text-[11px] opacity-70 min-h-[16px]">
            {searching ? (
              <span>Szukam…</span>
            ) : q.trim() && results.length === 0 ? (
              <span>Brak wyników dla „{q.trim()}”.</span>
            ) : (
              <span />
            )}
          </div>

          {results.length > 0 ? (
            <div className="rounded-md border border-border bg-background/20 p-2 space-y-1 max-h-[220px] overflow-auto">
              {results.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleAddOne(m)}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-background/40 transition flex items-center justify-between gap-2"
                >
                  <span className="truncate">{m.title}</span>
                  {m.unit ? (
                    <span className="text-[11px] opacity-70 border border-border rounded-md px-2 py-1 bg-card">
                      {m.unit}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* Messages */}
      {err ? (
        <div className="text-sm text-red-300 border border-red-500/40 rounded-2xl px-3 py-2 bg-red-500/10">
          {err}
        </div>
      ) : null}

      {okMsg ? (
        <div className="text-sm text-emerald-300 border border-emerald-500/40 rounded-2xl px-3 py-2 bg-emerald-500/10">
          {okMsg}
        </div>
      ) : null}

      {/* Items list */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        {items.length === 0 ? (
          <div className="text-sm opacity-70">
            Brak pozycji. Dodaj materiały (szukaj powyżej) albo użyj „Dodaj wszystkie”.
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((i) => {
              const diff = i.counted_qty !== null ? i.counted_qty - i.system_qty : null;
              const unit = i.material_unit ?? "";
              const diffText = diff === null ? "—" : diff > 0 ? `+${diff}` : `${diff}`;

              return (
                <div
                  key={i.item_id}
                  className="rounded-2xl border border-border bg-background/20 p-3 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{i.material_title}</div>
                    </div>

                    {/* ✅ w jednym wierszu (badge + usuń) jak było */}
                    <div className="flex items-center gap-2">
                      <span
                        className={[
                          "shrink-0 rounded-md border px-2.5 py-1 text-[11px]",
                          diffBadgeClasses(diff),
                        ].join(" ")}
                        title="Różnica = faktyczny - system"
                      >
                        {diff === null ? "Brak" : diffText}
                      </span>

                      {!props.approved ? (
                        <button
                          type="button"
                          onClick={() => handleRemove(i.material_id)}
                          className={dangerBtn}
                        >
                          Usuń
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {/* ✅ 3 pola w jednym wierszu też na mobile */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="grid gap-1">
                      <label className={labelBase}>System</label>
                      <div className={inputReadOnly} aria-label="Stan w systemie">
                        <span className="text-foreground/80">
                          {i.system_qty}
                          {unit ? ` ${unit}` : ""}
                        </span>
                      </div>
                    </div>

                    <div className="grid gap-1">
                      <label className={labelBase}>Faktyczny</label>

                      {props.approved ? (
                        <div className={inputReadOnly} aria-label="Stan faktyczny">
                          <span className="text-foreground/90">
                            {i.counted_qty ?? "—"}
                            {unit ? ` ${unit}` : ""}
                          </span>
                        </div>
                      ) : (
                        <input
                          type="text"
                          inputMode="decimal"
                          className={inputBase}
                          value={
                            qtyInput[i.material_id] ??
                            (i.counted_qty === null ? "" : String(i.counted_qty))
                          }
                          onChange={(e) => handleSetQty(i.material_id, e.target.value)}
                          placeholder="np. 12"
                        />
                      )}
                    </div>

                    <div className="grid gap-1">
                      <label className={labelBase}>Różnica</label>
                      <div className={inputReadOnly} aria-label="Różnica">
                        <span className="text-foreground/90">
                          {diffText}
                          {diff !== null && unit ? ` ${unit}` : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="text-[11px] text-muted-foreground">
          Tip: jeśli nie masz jeszcze pozycji w sesji — dodaj „wszystkie” i tylko wpisujesz faktyczne
          ilości.
        </div>
      </div>
    </div>
  );
}