// src/app/(app)/summary/_components/InventoryAuditSessionPanel.tsx
"use client";

import type React from "react";
import { useMemo } from "react";
import { useRouter } from "next/navigation";

function money(n: number): string {
  return new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 2 }).format(n);
}
function num(n: number): string {
  return new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 3 }).format(n);
}
function m(v: number | null | undefined) {
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  return money(v);
}
function n(v: number | null | undefined) {
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  return num(v);
}
function cleanText(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s : null;
}

function signMoney(v: number | null | undefined): { text: string; cls: string } {
  if (typeof v !== "number" || !Number.isFinite(v)) return { text: "—", cls: "" };
  if (v > 0) return { text: `+${money(v)}`, cls: "text-emerald-400" };
  if (v < 0) return { text: `-${money(Math.abs(v))}`, cls: "text-red-400" };
  return { text: money(0), cls: "text-muted-foreground" };
}
function signNum(v: number | null | undefined): { text: string; cls: string } {
  if (typeof v !== "number" || !Number.isFinite(v)) return { text: "—", cls: "" };
  if (v > 0) return { text: `+${num(v)}`, cls: "text-emerald-400" };
  if (v < 0) return { text: `-${num(Math.abs(v))}`, cls: "text-red-400" };
  return { text: num(0), cls: "text-muted-foreground" };
}

export default function InventoryAuditSessionPanel({
  session,
  items,
}: {
  session: any;
  items: any[];
}) {
  const router = useRouter();

  const sid = String(session?.session_id ?? "");
  const who = cleanText(session?.person) ?? "—";
  const titleDate = session?.session_date ?? "—";

  // STRATA z bazy (zwykle >= 0) -> pokazujemy jako ujemną
  const shrinkRaw =
    typeof session?.shrink_value_est === "number" && Number.isFinite(session.shrink_value_est)
      ? (session.shrink_value_est as number)
      : null;

  const shrinkAsSigned: number | null =
    typeof shrinkRaw === "number" && Number.isFinite(shrinkRaw) ? -Math.abs(shrinkRaw) : null;

  // SALDO z itemów (signed)
  const signedFromItems = useMemo(() => {
    let sum = 0;
    let hasAny = false;
    for (const r of items) {
      const v = r?.delta_value_est;
      if (typeof v === "number" && Number.isFinite(v)) {
        sum += v;
        hasAny = true;
      }
    }
    return hasAny ? sum : null;
  }, [items]);

  // ✅ tylko jedna liczba:
  // jeśli saldo z itemów != 0 -> pokaż saldo
  // inaczej -> pokaż stratę z bazy
  const oneValue: number | null =
    typeof signedFromItems === "number" && Number.isFinite(signedFromItems) && signedFromItems !== 0
      ? signedFromItems
      : shrinkAsSigned;

  const oneFmt = signMoney(oneValue);

  // ✅ link do raportów inwentaryzacji (jak chcesz)
  const sessionHref = sid ? `/reports/inventory/${sid}` : null;

  return (
    <details className="rounded-2xl border border-border bg-card px-3 py-2">
      <summary className="cursor-pointer list-none">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="text-sm font-semibold">
              Inwentaryzacja z dnia {titleDate} • {who}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              Pozycji z rozjazdem: {items.length}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 md:justify-end">
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Wartość różnicy</div>
              <div className={`text-lg font-semibold ${oneFmt.cls}`}>{oneFmt.text}</div>
            </div>

            {sessionHref ? (
              <button
                type="button"
                className="rounded-xl border border-border bg-muted/10 px-3 py-2 text-xs font-medium hover:bg-muted/20"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  router.push(sessionHref);
                }}
              >
                Szczegóły
              </button>
            ) : null}
          </div>
        </div>
      </summary>

      {items.length === 0 ? (
        <div className="mt-3 text-sm text-muted-foreground">Brak pozycji z rozjazdem w tej sesji.</div>
      ) : (
        <div className="mt-3">
          {/* ✅ NORMALNY SCROLL po prawej (jak dostawy) */}
          <div className="max-h-[360px] overflow-y-auto pr-1">
            <div className="space-y-3">
              {items.map((r: any) => {
                const materialId = String(r.material_id ?? "");
                const materialHref = materialId ? `/materials/${materialId}` : null;

                const deltaQty =
                  typeof r?.delta_qty === "number"
                    ? (r.delta_qty as number)
                    : typeof r?.counted_qty === "number" && typeof r?.system_qty === "number"
                      ? (r.counted_qty as number) - (r.system_qty as number)
                      : null;

                const deltaQtyFmt = signNum(deltaQty);

                const deltaValue =
                  typeof r?.delta_value_est === "number" && Number.isFinite(r.delta_value_est)
                    ? (r.delta_value_est as number)
                    : null;

                const deltaValueFmt = signMoney(deltaValue);

                return (
                  <div
                    key={`${sid}:${materialId || r.title || Math.random()}`}
                    className="rounded-2xl border border-border/80 bg-muted/10 p-4"
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="font-medium leading-5">{r.title ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{r.unit ?? "—"}</div>
                      </div>

                      {materialHref ? (
                        <button
                          type="button"
                          className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted/20"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            router.push(materialHref);
                          }}
                        >
                          Otwórz materiał
                        </button>
                      ) : null}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5">
                      <div className="rounded-xl border border-border/70 bg-card px-3 py-2">
                        <div className="text-[11px] text-muted-foreground">Powinno</div>
                        <div className="mt-0.5 font-mono text-sm">{n(r.system_qty)}</div>
                      </div>

                      <div className="rounded-xl border border-border/70 bg-card px-3 py-2">
                        <div className="text-[11px] text-muted-foreground">Po inwent.</div>
                        <div className="mt-0.5 font-mono text-sm">{n(r.counted_qty)}</div>
                      </div>

                      <div className="rounded-xl border border-border/70 bg-card px-3 py-2">
                        <div className="text-[11px] text-muted-foreground">WAC (z dnia)</div>
                        <div className="mt-0.5 font-mono text-sm">{m(r.wac_unit_price)}</div>
                      </div>

                      <div className="rounded-xl border border-border/70 bg-card px-3 py-2">
                        <div className="text-[11px] text-muted-foreground">Δ ilości</div>
                        <div className={`mt-0.5 font-mono text-sm ${deltaQtyFmt.cls}`}>{deltaQtyFmt.text}</div>
                      </div>

                      <div className="rounded-xl border border-border/70 bg-card px-3 py-2">
                        <div className="text-[11px] text-muted-foreground">Wartość zmiany</div>
                        <div className={`mt-0.5 font-mono text-sm ${deltaValueFmt.cls}`}>{deltaValueFmt.text}</div>
                      </div>
                    </div>

                    {/* ✅ usunięty napis pod pozycją (chciałeś wywalić) */}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </details>
  );
}