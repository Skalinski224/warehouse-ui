"use client";

import { useMemo, useState } from "react";
import type { DesignerPlanCreateInput } from "@/lib/dto/designerPlan";
import MaterialCombobox, { type MaterialOption } from "@/components/MaterialCombobox";

type Props = {
  materials: MaterialOption[];
  onAdd: (input: DesignerPlanCreateInput) => Promise<void>;
};

export default function PlanAddForm({ materials, onAdd }: Props) {
  const [materialId, setMaterialId] = useState<string | null>(null);
  const [qty, setQty] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const picked = useMemo(
    () => materials.find((m) => m.id === materialId) ?? null,
    [materials, materialId]
  );

  const qtyNum = Number(qty);
  const qtyOk = Number.isFinite(qtyNum) && qtyNum > 0;

  async function submit() {
    if (!picked || !qtyOk || loading) return;

    setLoading(true);
    try {
      await onAdd({
        material_id: picked.id,
        family_key: picked.family_key,
        planned_qty: qtyNum,
        stage_id: null,
        place_id: null,
      });

      setMaterialId(null);
      setQty("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Dodaj do planu projektanta</h3>
        <div className="mt-1 text-xs text-foreground/60">
          Wybierasz materiał → zapisujemy jego <span className="font-mono">family_key</span>.
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_220px_160px] items-end">
        {/* MATERIAL */}
        <div className="space-y-1">
          <div className="text-xs text-foreground/60">Materiał</div>
          <MaterialCombobox
            options={materials}
            valueId={materialId}
            onChange={setMaterialId}
            disabled={loading}
          />
        </div>

        {/* QTY */}
        <div className="space-y-1">
          <div className="text-xs text-foreground/60">Planowana ilość</div>
          <div className="relative">
            <input
              type="number"
              className="w-full h-9 px-3 rounded bg-muted text-sm text-foreground border border-border outline-none"
              placeholder="np. 120"
              value={qty}
              min={0}
              step="any"
              onChange={(e) => setQty(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              disabled={loading}
            />
            {picked?.unit && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-foreground/60 font-mono">
                {picked.unit}
              </div>
            )}
          </div>
        </div>

        {/* SUBMIT */}
        <button
          className="h-9 px-3 rounded bg-foreground text-background text-sm disabled:opacity-50"
          disabled={!picked || !qtyOk || loading}
          onClick={submit}
        >
          {loading ? "Dodawanie…" : "Dodaj"}
        </button>
      </div>
    </div>
  );
}
