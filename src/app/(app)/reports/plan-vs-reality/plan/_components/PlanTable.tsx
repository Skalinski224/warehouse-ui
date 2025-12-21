import type { DesignerPlanViewRow } from "@/lib/dto/designerPlan";
import PlanRow from "./PlanRow";

type Props = {
  rows: DesignerPlanViewRow[];
  onUpdateQty: (id: string, qty: number) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

export default function PlanTable({ rows, onUpdateQty, onDelete }: Props) {
  if (!rows.length) {
    return (
      <div className="text-sm text-foreground/60">
        Brak pozycji w planie projektanta.
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-3 py-2 text-left">Materiał</th>
            <th className="px-3 py-2 text-right">Plan</th>
            <th className="px-3 py-2 w-[120px]"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <PlanRow
              key={row.id}
              row={row}
              onUpdateQty={onUpdateQty}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
