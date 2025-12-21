"use client";

import type { DesignerPlanViewRow } from "@/lib/dto/designerPlan";
import PlanQtyInput from "./PlanQtyInput";

type Props = {
  row: DesignerPlanViewRow;
  onUpdateQty: (id: string, qty: number) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

export default function PlanRow({ row, onUpdateQty, onDelete }: Props) {
  return (
    <tr className="border-t">
      <td className="px-3 py-2">
        <div className="font-medium">{row.material_title}</div>
        <div className="text-xs text-foreground/60">{row.family_key}</div>
      </td>

      <td className="px-3 py-2 text-right">
        <PlanQtyInput
          value={row.planned_qty}
          unit={row.unit}
          onChange={(qty) => onUpdateQty(row.id, qty)}
        />
      </td>

      <td className="px-3 py-2 text-right">
        <button
          className="text-xs text-red-500 hover:underline"
          onClick={() => onDelete(row.id)}
        >
          Usuń
        </button>
      </td>
    </tr>
  );
}
