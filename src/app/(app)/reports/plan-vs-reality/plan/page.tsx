// src/app/(app)/reports/designer-vs-real/plan/page.tsx

import type { Metadata } from "next";
import { revalidatePath } from "next/cache";

import { fetchMaterials } from "@/lib/queries/materials";
import {
  fetchDesignerPlans,
  createDesignerPlan,
  updateDesignerPlanQty,
  deleteDesignerPlan,
} from "@/lib/queries/designerPlans";

import PlanAddForm from "./_components/PlanAddForm";
import PlanTable from "./_components/PlanTable";

import { getPermissionSnapshot } from "@/lib/currentUser";
import { can, PERM } from "@/lib/permissions";

export const metadata: Metadata = {
  title: "Plan projektanta",
};

export default async function DesignerPlanPage() {
  // ✅ GATE — tylko manager + owner
  const snap = await getPermissionSnapshot();
  if (!can(snap, PERM.METRICS_READ)) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-sm text-foreground/80">
        Brak dostępu.
      </div>
    );
  }

  const [materialsRaw, planRows] = await Promise.all([
    fetchMaterials({
      q: "",
      sort: "title",
      dir: "asc",
      include_deleted: false,
      limit: 1000,
      offset: 0,
    }),
    fetchDesignerPlans(),
  ]);

  const materials = (materialsRaw ?? [])
    .filter((m: any) => !m.deleted_at)
    .filter((m: any) => !!m.family_key)
    .map((m: any) => ({
      id: m.id as string,
      title: (m.title ?? "") as string,
      family_key: m.family_key as string,
      unit: (m.unit ?? null) as string | null,
    }))
    .sort((a, b) => a.title.localeCompare(b.title));

  async function onAdd(input: any) {
    "use server";
    await createDesignerPlan(input);
    revalidatePath("/reports/designer-vs-real/plan");
    revalidatePath("/reports/designer-vs-real");
  }

  async function onUpdateQty(id: string, planned_qty: number) {
    "use server";
    await updateDesignerPlanQty({ id, planned_qty });
    revalidatePath("/reports/designer-vs-real/plan");
    revalidatePath("/reports/designer-vs-real");
  }

  async function onDelete(id: string) {
    "use server";
    await deleteDesignerPlan(id);
    revalidatePath("/reports/designer-vs-real/plan");
    revalidatePath("/reports/designer-vs-real");
  }

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="text-sm font-semibold">Plan projektanta</div>
        <div className="mt-1 text-sm text-foreground/70">
          Plan jest <b>globalny dla projektu</b>. Dashboard analizuje dane tylko
          z pozycji dodanych tutaj.
        </div>
      </div>

      <PlanAddForm materials={materials} onAdd={onAdd} />

      <PlanTable
        rows={planRows}
        onUpdateQty={onUpdateQty}
        onDelete={onDelete}
      />
    </div>
  );
}
