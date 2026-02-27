// src/app/(app)/materials/_components/MaterialsGridClient.tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { useTransferMode } from "@/app/(app)/materials/_components/TransferModeContext";

type MaterialRow = {
  id: string;
  title: string;
  description?: string | null;
  unit?: string | null;
  image_url?: string | null;
  base_quantity?: number | string | null;
  current_quantity?: number | string | null;
  inventory_location_id?: string | null;
  inventory_location_label?: string | null;
  family_key?: string | null;
};

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function clampPct(pct: number) {
  return Math.max(0, Math.min(100, pct));
}

function toNum(v: unknown) {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v) || 0;
  return 0;
}

function randKey() {
  return `reloc-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function findDestQty(input: {
  accountScoped: boolean;
  to_location_id: string;
  family_key: string | null;
  title: string;
  unit: string | null;
}): Promise<{ qty: number; destId: string | null }> {
  const sb = supabaseBrowser();

  // prefer family_key
  if (input.family_key) {
    const { data } = await sb
      .from("materials")
      .select("id,current_quantity")
      .eq("inventory_location_id", input.to_location_id)
      .is("deleted_at", null)
      .eq("family_key", input.family_key)
      .limit(1);

    const r = Array.isArray(data) ? data[0] : null;
    if (r?.id) return { qty: toNum((r as any).current_quantity), destId: String(r.id) };
  }

  // fallback title+unit
  const { data } = await sb
    .from("materials")
    .select("id,current_quantity,unit,title")
    .eq("inventory_location_id", input.to_location_id)
    .is("deleted_at", null)
    .eq("title", input.title)
    .limit(10);

  if (Array.isArray(data)) {
    const match = data.find((x: any) => String(x?.unit ?? "") === String(input.unit ?? ""));
    if (match?.id) return { qty: toNum(match.current_quantity), destId: String(match.id) };
  }

  return { qty: 0, destId: null };
}

export default function MaterialsGridClient({
  rows,
  isLastPage,
  prevHref,
  nextHref,
  pageLabel,
}: {
  rows: MaterialRow[];
  isLastPage: boolean;
  prevHref: string;
  nextHref: string;
  pageLabel: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const { enabled, target } = useTransferMode();

  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [src, setSrc] = useState<MaterialRow | null>(null);
  const [avail, setAvail] = useState<number>(0);
  const [destQty, setDestQty] = useState<number>(0);
  const [qtyInput, setQtyInput] = useState<string>("1");
  const [busy, setBusy] = useState(false);

  const fromLabel = useMemo(() => {
    return (src?.inventory_location_label ?? "—") as string;
  }, [src]);

  const toLabel = useMemo(() => {
    return target?.to_location_label ?? "—";
  }, [target]);

  const qtyWanted = useMemo(() => {
    const n = Number(qtyInput);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [qtyInput]);

  const destAfter = useMemo(() => destQty + qtyWanted, [destQty, qtyWanted]);

  function setToast(msg: string, tone: "ok" | "err") {
    const p = new URLSearchParams(sp.toString());
    p.set("toast", encodeURIComponent(msg));
    p.set("tone", tone);
    router.replace(`${pathname}?${p.toString()}`);
  }

  async function openTransfer(m: MaterialRow) {
    if (!enabled || !target) return;
    if (!m.inventory_location_id || m.inventory_location_id === target.to_location_id) {
      setToast("Nie możesz przenosić do tej samej lokalizacji.", "err");
      return;
    }

    setSrc(m);
    const have = toNum(m.current_quantity);
    setAvail(have);
    setQtyInput("1");

    // pobierz ile jest docelowo (do podglądu “będzie w docelowej”)
    try {
      const { qty } = await findDestQty({
        accountScoped: true,
        to_location_id: target.to_location_id,
        family_key: (m.family_key ?? null) as any,
        title: String(m.title ?? ""),
        unit: (m.unit ?? null) as any,
      });
      setDestQty(qty);
    } catch {
      setDestQty(0);
    }

    setOpen(true);
  }

  function closeAll() {
    setOpen(false);
    setConfirmOpen(false);
    setSrc(null);
    setBusy(false);
  }

  function askConfirm() {
    if (!src || !target) return;
    if (qtyWanted <= 0) return;
    if (qtyWanted > avail) {
      setToast("Za mało stanu w lokalizacji źródłowej.", "err");
      return;
    }
    setConfirmOpen(true);
  }

  async function doTransfer() {
    if (!src || !target) return;
    if (busy) return;

    const qty = qtyWanted;
    if (!qty || qty <= 0) return;

    setBusy(true);
    try {
      const sb = supabaseBrowser();
      const client_key = randKey();

      const { data, error } = await sb.rpc("create_inventory_relocation", {
        p_from_material_id: src.id,
        p_to_location_id: target.to_location_id,
        p_qty: qty,
        p_note: null,
        p_client_key: client_key,
      });

      if (error) throw error;

      // odśwież listę (server component)
      router.refresh();

      const msg = `Przeniesiono ${qty} ${src.unit ?? ""} “${src.title}” z “${fromLabel}” do “${toLabel}”.`;
      setToast(msg, "ok");

      // zostajemy w trybie transferu → zamykamy modale
      closeAll();
      return data;
    } catch (e: any) {
      setToast("Nie udało się wykonać transferu.", "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <ul className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {rows.map((m) => {
          const base = toNum(m.base_quantity);
          const cur = toNum(m.current_quantity);
          const pct = base > 0 ? Math.round((cur / base) * 100) : 0;

          const locLabel = (m.inventory_location_label ?? "—") as string;

          const card = (
            <div className="p-4">
              <div className="flex gap-4">
                <div className="w-28 h-28 rounded-xl overflow-hidden bg-background/50 border border-border flex-shrink-0 relative">
                  {m.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.image_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-xs opacity-60">brak zdjęcia</div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{m.title}</div>

                      {m.description ? (
                        <div className="mt-1 text-sm opacity-80 line-clamp-2">{m.description}</div>
                      ) : (
                        <div className="mt-1 text-sm opacity-50 line-clamp-2">—</div>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-[11px] px-2 py-1 rounded bg-background/60 border border-border">
                        {m.unit}
                      </span>

                      <span className="text-[10px] px-2 py-1 rounded border border-emerald-500/35 bg-emerald-500/10 text-emerald-300">
                        {locLabel}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm opacity-70">Stan</span>
                        <span className="text-sm font-medium truncate">
                          {cur} / {base} {m.unit}
                        </span>
                      </div>
                      <div className="text-sm font-medium opacity-80 flex-shrink-0">{pct}%</div>
                    </div>

                    <div className="mt-2 h-2 rounded bg-background/60 overflow-hidden">
                      <div
                        className={cx("h-full", pct <= 25 ? "bg-red-500/70" : "bg-foreground/70")}
                        style={{ width: `${clampPct(pct)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {enabled ? (
                <div className="mt-3 text-xs opacity-70">
                  Kliknij, aby przenieść do: <span className="font-medium">{toLabel}</span>
                </div>
              ) : null}
            </div>
          );

          return (
            <li
              key={m.id}
              className={cx(
                "rounded-2xl border border-border bg-card overflow-hidden transition hover:bg-background/10 hover:border-border/80",
                enabled ? "cursor-pointer" : ""
              )}
              onClick={enabled ? () => openTransfer(m) : undefined}
            >
              {enabled ? (
                <div className="block">{card}</div>
              ) : (
                <Link href={`/materials/${m.id}`} className="block transition hover:bg-background/10">
                  {card}
                </Link>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex items-center justify-between gap-3 pt-2">
        <Link
          href={prevHref}
          className={cx(
            "border border-border px-3 py-2 rounded bg-card hover:bg-card/80",
            prevHref.includes("page=1") ? "" : ""
          )}
        >
          ← Poprzednia
        </Link>

        <div className="text-sm opacity-70">{pageLabel}</div>

        <Link
          href={nextHref}
          className={cx(
            "border border-border px-3 py-2 rounded bg-card hover:bg-card/80",
            isLastPage ? "pointer-events-none opacity-50" : ""
          )}
          aria-disabled={isLastPage}
        >
          Następna →
        </Link>
      </div>

      {/* Modal: ilość */}
      {open && src && target ? (
        <div className="fixed inset-0 z-[70]">
          <div className="absolute inset-0 bg-black/60" onClick={closeAll} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl">
              <div className="flex items-start justify-between gap-3 p-5">
                <div>
                  <div className="text-base font-semibold">Transfer materiału</div>
                  <div className="mt-1 text-sm opacity-80">
                    Przenosisz <span className="font-medium">{src.title}</span> z{" "}
                    <span className="font-medium">{fromLabel}</span> do{" "}
                    <span className="font-medium">{toLabel}</span>.
                  </div>
                </div>
                <button
                  type="button"
                  className="rounded-md border border-border bg-background/20 px-3 py-2 text-xs hover:bg-background/30"
                  onClick={closeAll}
                >
                  Zamknij
                </button>
              </div>

              <div className="px-5 pb-5">
                {/* 3 prostokąty w jednym wierszu (mobile też) */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-border bg-background/20 p-3">
                    <div className="text-[11px] uppercase tracking-wide opacity-70">Masz w źródłowej</div>
                    <div className="mt-1 text-lg font-semibold">
                      {avail} <span className="text-sm opacity-70">{src.unit}</span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-background/20 p-3">
                    <div className="text-[11px] uppercase tracking-wide opacity-70">Ile przenieść</div>
                    <input
                      value={qtyInput}
                      onChange={(e) => setQtyInput(e.target.value)}
                      inputMode="decimal"
                      className="mt-2 w-full rounded-md border border-border bg-background/40 px-3 py-2 text-sm"
                      placeholder="np. 1"
                    />
                    <div className="mt-1 text-[11px] opacity-70">Maks: {avail}</div>
                  </div>

                  <div className="rounded-xl border border-border bg-background/20 p-3">
                    <div className="text-[11px] uppercase tracking-wide opacity-70">Będzie w docelowej</div>
                    <div className="mt-1 text-lg font-semibold">
                      {destAfter} <span className="text-sm opacity-70">{src.unit}</span>
                    </div>
                    <div className="mt-1 text-[11px] opacity-70">Obecnie: {destQty}</div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-md border border-border bg-card px-3 py-2 text-xs hover:bg-background/10"
                    onClick={closeAll}
                    disabled={busy}
                  >
                    Anuluj
                  </button>
                  <button
                    type="button"
                    className={cx(
                      "rounded-md border px-3 py-2 text-xs font-medium",
                      "border-emerald-500/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/20",
                      busy ? "opacity-60 cursor-not-allowed" : ""
                    )}
                    onClick={askConfirm}
                    disabled={busy}
                  >
                    Potwierdź
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Confirm modal */}
      {confirmOpen && src && target ? (
        <div className="fixed inset-0 z-[80]">
          <div className="absolute inset-0 bg-black/60" onClick={() => setConfirmOpen(false)} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-xl rounded-2xl border border-border bg-card shadow-2xl">
              <div className="p-5">
                <div className="text-base font-semibold">Potwierdzić transfer?</div>
                <div className="mt-2 text-sm opacity-80">
                  Przenieść <span className="font-medium">{qtyWanted}</span> {src.unit ?? ""}{" "}
                  <span className="font-medium">“{src.title}”</span> z{" "}
                  <span className="font-medium">{fromLabel}</span> do{" "}
                  <span className="font-medium">{toLabel}</span>?
                </div>

                <div className="mt-5 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-md border border-border bg-card px-3 py-2 text-xs hover:bg-background/10"
                    onClick={() => setConfirmOpen(false)}
                    disabled={busy}
                  >
                    Anuluj
                  </button>
                  <button
                    type="button"
                    className={cx(
                      "rounded-md border px-3 py-2 text-xs font-medium",
                      "border-emerald-500/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/20",
                      busy ? "opacity-60 cursor-not-allowed" : ""
                    )}
                    onClick={doTransfer}
                    disabled={busy}
                  >
                    Tak, przenieś
                  </button>
                </div>

                {busy ? <div className="mt-3 text-xs opacity-70">Wykonuję transfer…</div> : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}