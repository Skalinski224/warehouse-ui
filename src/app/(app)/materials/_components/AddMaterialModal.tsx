// src/app/(app)/materials/_components/AddMaterialModal.tsx
import Link from "next/link";
import AddMaterialModalClient from "@/app/(app)/materials/_components/AddMaterialModalClient";
import AddMaterialModalShell from "@/app/(app)/materials/_components/AddMaterialModalShell";

type LocationOption = { id: string; label: string };

export default function AddMaterialModal({
  add,
  canWrite,
  addMaterialAction,
  mkQuery,
  q,
  sort,
  dir,
  page,
  multi,
  loc,
  state,
  locations,
  defaultLocationId,
}: {
  add: boolean;
  canWrite: boolean;
  addMaterialAction: (formData: FormData) => Promise<void>; // server action
  mkQuery: (overrides: Record<string, string | number | boolean | undefined>) => string; // server fn
  q: string;
  sort: string;
  dir: string;
  page: number;
  multi: boolean;
  loc: string;
  state: "active" | "deleted";
  locations: any[];
  defaultLocationId: string;
}) {
  if (!add || !canWrite) return null;

  const normalizedLocations: LocationOption[] = (() => {
    const map = new Map<string, LocationOption>();
    for (const l of locations ?? []) {
      const id = String((l as any)?.id ?? "").trim();
      if (!id) continue;
      const label = String((l as any)?.label ?? "").trim() || "—";
      if (!map.has(id)) map.set(id, { id, label });
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, "pl"));
  })();

  const closeHref = mkQuery({ add: false });

  return (
    <AddMaterialModalShell onCloseHref={closeHref}>
      <form action={addMaterialAction} className="grid gap-3 p-4">
        {/* zachowaj filtry po zapisie */}
        <input type="hidden" name="q" value={q ?? ""} />
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="dir" value={dir} />
        <input type="hidden" name="page" value={page} />
        <input type="hidden" name="multi" value={multi ? "1" : ""} />
        <input type="hidden" name="loc" value={loc ?? ""} />
        <input type="hidden" name="state" value={state ?? "active"} />

        <div className="grid gap-2">
          <label className="text-sm">Tytuł *</label>
          <input
            name="title"
            required
            placeholder="np. Pręt fi10"
            className="w-full border border-border bg-background rounded px-3 py-2"
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm">Opis</label>
          <textarea
            name="description"
            rows={2}
            placeholder="Krótki opis (opcjonalnie)"
            className="w-full border border-border bg-background rounded px-3 py-2"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="grid gap-2">
            <label className="text-sm">Jednostka</label>
            <select
              name="unit"
              defaultValue="szt"
              className="w-full border border-border bg-background rounded px-3 py-2"
            >
              <option value="szt">szt</option>
              <option value="kg">kg</option>
              <option value="m">m</option>
              <option value="m2">m²</option>
              <option value="m3">m³</option>
              <option value="l">l</option>
              <option value="opak">opak</option>
            </select>
          </div>

          <div className="grid gap-2">
            <label className="text-sm">Baza *</label>
            <input
              type="number"
              name="base_quantity"
              required
              min={0}
              step={1}
              inputMode="numeric"
              placeholder="100"
              className="w-full border border-border bg-background rounded px-3 py-2"
              title="Wpisz pełną liczbę (bez części po przecinku)."
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm">Stan</label>
            <input
              type="number"
              name="current_quantity"
              min={0}
              step={1}
              inputMode="numeric"
              placeholder="0"
              defaultValue={0}
              className="w-full border border-border bg-background rounded px-3 py-2"
              title="Wpisz pełną liczbę (bez części po przecinku)."
            />
          </div>
        </div>

        {/* interaktywne: lokacja + upload */}
        <AddMaterialModalClient locations={normalizedLocations} defaultLocationId={defaultLocationId} />

        {/* ✅ sticky footer — na mobile przycisk nie znika pod klawiaturą */}
        <div className="sticky bottom-0 -mx-4 px-4 pt-3 pb-4 bg-card/95 backdrop-blur border-t border-border">
          <div className="flex items-center justify-end gap-2">
            <Link href={closeHref} className="px-3 py-2 rounded border border-border bg-background text-sm">
              Anuluj
            </Link>

            <button className="px-3 py-2 rounded border border-border bg-card hover:bg-card/80 text-sm">
              Dodaj
            </button>
          </div>
        </div>
      </form>
    </AddMaterialModalShell>
  );
}