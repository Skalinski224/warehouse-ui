// src/components/Materials/DeleteRestoreButtons.tsx
import { softDeleteMaterial, restoreMaterial } from "@/lib/actions";
import { supabaseServer } from "@/lib/supabaseServer";
import { PERM } from "@/lib/permissions";

type Variant = "delete" | "restore";
type Size = "sm" | "md";

export type DeleteRestoreButtonProps = {
  /** ID materiału */
  id: string;
  /** Wariant przycisku: delete (aktywny katalog / szczegóły) lub restore (historia usuniętych) */
  variant: Variant;
  /** Rozmiar przycisku (styl) */
  size?: Size;
  /** Nadpisanie etykiety przycisku (opcjonalne) */
  label?: string;
  /** Dodatkowe klasy */
  className?: string;
};

type SnapshotRow = { key: string; allowed: boolean };

async function canSoftDeleteMaterials(): Promise<boolean> {
  const sb = await supabaseServer();
  const { data, error } = await sb.rpc("my_permissions_snapshot");
  if (error) return false;
  const rows: SnapshotRow[] = Array.isArray(data) ? data : [];
  const set = new Set(rows.filter((r) => r?.allowed).map((r) => String(r.key)));
  return set.has(PERM.MATERIALS_SOFT_DELETE);
}

/** Akcja serwerowa: soft delete przez FormData → wywołuje softDeleteMaterial(id) */
async function deleteAction(formData: FormData) {
  "use server";

  // permissions gate (twardo)
  if (!(await canSoftDeleteMaterials())) return;

  const id = String(formData.get("id") || "");
  if (!id) return;
  await softDeleteMaterial(id);
}

/** Akcja serwerowa: restore przez FormData → wywołuje restoreMaterial(id) */
async function restoreAction(formData: FormData) {
  "use server";

  // permissions gate (twardo)
  if (!(await canSoftDeleteMaterials())) return;

  const id = String(formData.get("id") || "");
  if (!id) return;
  await restoreMaterial(id);
}

export default function DeleteRestoreButton({
  id,
  variant,
  size = "md",
  label,
  className = "",
}: DeleteRestoreButtonProps) {
  const base = "inline-flex items-center justify-center rounded border transition text-sm";
  const sizes = size === "sm" ? "px-2 py-1" : "px-3 py-2";

  const styleDelete = "border-red-600/40 bg-red-600/20 hover:bg-red-600/30 text-red-100";
  const styleRestore = "border-green-600/40 bg-green-600/20 hover:bg-green-600/30 text-green-100";

  const text = label ?? (variant === "delete" ? "Usuń z katalogu" : "Przywróć pozycję");
  const action = variant === "delete" ? deleteAction : restoreAction;
  const variantStyle = variant === "delete" ? styleDelete : styleRestore;

  return (
    <form action={action} className={className}>
      <input type="hidden" name="id" value={id} />
      <button className={`${base} ${sizes} ${variantStyle} border-border`}>
        {text}
      </button>
    </form>
  );
}
