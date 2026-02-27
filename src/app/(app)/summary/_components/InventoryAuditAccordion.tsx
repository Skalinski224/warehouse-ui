// src/app/(app)/summary/_components/InventoryAuditAccordion.tsx
"use client";

import type React from "react";
import type { InventoryAuditDto } from "@/lib/dto/inventoryAudit";
import InventoryAuditSessionPanel from "@/app/(app)/summary/_components/InventoryAuditSessionPanel";

export default function InventoryAuditAccordion({ data }: { data: InventoryAuditDto }) {
  const sessionsAll = Array.isArray(data.sessions) ? data.sessions : [];

  return (
    <div className="card p-4">
      {/* ✅ jeden nagłówek (bez "audyt") */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Inwentaryzacja (straty na materiale)</h2>

        <div className="text-xs text-muted-foreground">
          Sesji: <span className="font-semibold text-foreground">{sessionsAll.length}</span>
        </div>
      </div>

      {sessionsAll.length === 0 ? (
        <div className="mt-3 text-sm text-muted-foreground">Brak danych w tym zakresie.</div>
      ) : (
        <div className="mt-3">
          {/* ✅ NORMALNY SCROLL jak w dostawach (pasek po prawej) */}
          <div className="max-h-[420px] overflow-y-auto pr-1">
            <div className="space-y-3">
              {sessionsAll.map((s: any) => {
                const sid = String(s?.session_id ?? "");
                const items = sid ? data.itemsBySession?.[sid] ?? [] : [];
                return (
                  <InventoryAuditSessionPanel
                    key={sid || Math.random()}
                    session={s}
                    items={items}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* STOPKA */}
      <div className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground space-y-1">
        <p>
          Pokazuje różnicę między stanem systemowym a stanem fizycznie policzonym podczas zatwierdzonej inwentaryzacji.
        </p>
        <p>Jeśli materiału brakuje – traktowane jest to jako strata.</p>
        <p>Jeśli jest go więcej – różnica pomniejsza straty.</p>
        <p>
          Wycena odbywa się według tej samej średniej ceny (WAC) – lokalnej lub globalnej, zależnie od wybranego widoku.
        </p>
        <p>
          To pozwala zobaczyć realne ubytki w przeliczeniu na pieniądze i szybciej wykryć nieprawidłowości w obiegu materiału.
        </p>
      </div>
    </div>
  );
}