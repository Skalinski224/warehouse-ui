// src/components/inventory/InventoryEditor.tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import InventoryItemsTable from "@/components/inventory/InventoryItemsTable";
import MaterialSearchAdd from "@/components/inventory/MaterialSearchAdd";

type Item = {
  item_id: string;
  material_id: string;
  material_title: string;
  material_unit: string | null;
  system_qty: number;
  counted_qty: number | null;
};

type MaterialOption = {
  id: string;
  title: string;
  unit: string | null;
};

export default function InventoryEditor(props: {
  sessionId: string;
  approved: boolean;
  initialItems: Item[];

  addAll: (sessionId: string) => Promise<{ inserted?: number } | any>;
  addItem: (sessionId: string, materialId: string) => Promise<any>;
  removeItem: (sessionId: string, materialId: string) => Promise<any>;

  setQty: (
    sessionId: string,
    materialId: string,
    countedQty: number | null
  ) => Promise<any>;

  // zostawiamy w propsach, ale tu nie używamy
  approve: (sessionId: string) => Promise<any>;

  searchMaterials: (q: string) => Promise<{ rows: MaterialOption[] }>;
}) {
  const [items, setItems] = useState<Item[]>(props.initialItems);
  const [visible, setVisible] = useState(50);
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null
  );

  const missingCount = useMemo(
    () => items.filter((i) => i.counted_qty === null).length,
    [items]
  );

  function onAddAll() {
    setMsg(null);
    startTransition(async () => {
      try {
        const res = await props.addAll(props.sessionId);
        const inserted = Number((res as any)?.inserted ?? 0);
        setMsg({
          kind: "ok",
          text:
            inserted > 0
              ? `Dodano ${inserted} pozycji (tylko aktywne materiały).`
              : "Brak nowych pozycji do dodania.",
        });

        // backend i tak robi revalidatePath — odświeżamy listę
        location.reload();
      } catch (e: any) {
        setMsg({ kind: "err", text: e?.message || "Nie udało się dodać pozycji." });
      }
    });
  }

  function onRemove(materialId: string) {
    setMsg(null);
    startTransition(async () => {
      try {
        await props.removeItem(props.sessionId, materialId);
        setItems((prev) => prev.filter((i) => i.material_id !== materialId));
      } catch (e: any) {
        setMsg({ kind: "err", text: e?.message || "Nie udało się usunąć pozycji." });
      }
    });
  }

  function onQty(materialId: string, value: string) {
    const raw = value.trim();

    if (!raw) {
      setItems((prev) =>
        prev.map((i) =>
          i.material_id === materialId ? { ...i, counted_qty: null } : i
        )
      );

      startTransition(async () => {
        try {
          await props.setQty(props.sessionId, materialId, null);
        } catch {
          // UX > hard fail
        }
      });

      return;
    }

    const n = Number(raw.replace(",", "."));
    if (!Number.isFinite(n)) return;

    setItems((prev) =>
      prev.map((i) =>
        i.material_id === materialId ? { ...i, counted_qty: n } : i
      )
    );

    startTransition(async () => {
      try {
        await props.setQty(props.sessionId, materialId, n);
      } catch {
        // UX > hard fail
      }
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-3 sm:p-4 space-y-3">
      {!props.approved ? (
        <div className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm font-medium">Pozycje inwentaryzacji</div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
              <button
                type="button"
                onClick={onAddAll}
                disabled={isPending || props.approved}
                className={[
                  "rounded-xl border border-border bg-background/20 px-3 py-2 text-xs",
                  "hover:bg-background/30 active:bg-background/40 transition",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                ].join(" ")}
              >
                Dodaj wszystkie z magazynu
              </button>

              <MaterialSearchAdd
                sessionId={props.sessionId}
                disabled={props.approved || isPending}
                searchMaterials={props.searchMaterials}
                addItem={props.addItem}
                onAdded={() => location.reload()}
              />
            </div>
          </div>

          {msg ? (
            <div
              className={[
                "rounded-xl border px-3 py-2 text-xs",
                msg.kind === "err"
                  ? "border-red-500/40 bg-red-500/10 text-red-300"
                  : "border-border bg-background/20 text-muted-foreground",
              ].join(" ")}
            >
              {msg.text}
            </div>
          ) : null}
        </div>
      ) : null}

      <InventoryItemsTable
        items={items}
        visible={visible}
        approved={props.approved}
        onQtyBlur={(materialId, value) => onQty(materialId, value)}
        onRemove={(materialId) => onRemove(materialId)}
      />

      {items.length > visible ? (
        <button
          type="button"
          onClick={() => setVisible((v) => v + 50)}
          className="w-full rounded-xl border border-border bg-background/10 px-3 py-2 text-xs text-muted-foreground hover:bg-background/20 active:bg-background/30 transition"
        >
          Pokaż więcej (+50)
        </button>
      ) : null}

      {!props.approved ? (
        <div className="border-t border-border pt-3 text-xs text-muted-foreground">
          Brakujące pozycje:{" "}
          <span className="text-foreground">{missingCount}</span>
          <span className="mx-2">•</span>
          Zatwierdzanie robisz w podsumowaniu.
        </div>
      ) : null}
    </div>
  );
}
