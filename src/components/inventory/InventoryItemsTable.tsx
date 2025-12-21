// src/components/inventory/InventoryItemsTable.tsx
"use client";

type Item = {
  item_id: string;
  material_id: string;
  material_title: string;
  material_unit: string | null;
  system_qty: number;
  counted_qty: number | null;
};

function fmtDiff(diff: number) {
  if (!Number.isFinite(diff)) return "—";
  if (diff > 0) return `+${diff}`;
  return `${diff}`;
}

export default function InventoryItemsTable(props: {
  items: Item[];
  visible: number;
  approved: boolean;

  onQtyBlur?: (materialId: string, value: string) => void;
  onRemove?: (materialId: string) => void;
}) {
  const rows = props.items.slice(0, props.visible);

  if (!props.items.length) {
    return (
      <div className="rounded-xl border border-border p-3 text-xs text-muted-foreground bg-background/10">
        Brak pozycji w tej inwentaryzacji. Dodaj wszystkie albo wyszukaj materiał.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* MOBILE / TABLET: karty */}
      <div className="grid gap-2 sm:hidden">
        {rows.map((i) => {
          const unit = i.material_unit ?? "";
          const diff =
            i.counted_qty !== null ? i.counted_qty - i.system_qty : null;

          return (
            <div
              key={i.item_id}
              className="rounded-2xl border border-border bg-background/10 p-3 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {i.material_title}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    Stan w systemie:{" "}
                    <span className="text-foreground">
                      {i.system_qty}
                      {unit ? ` ${unit}` : ""}
                    </span>
                  </div>
                </div>

                {!props.approved ? (
                  <button
                    type="button"
                    onClick={() => props.onRemove?.(i.material_id)}
                    className="shrink-0 rounded-lg border border-red-500/40 bg-red-500/10 px-2 py-1 text-[11px] text-red-300 hover:bg-red-500/15 active:bg-red-500/20 transition"
                  >
                    Usuń
                  </button>
                ) : null}
              </div>

              <div className="grid gap-2">
                <div className="text-[11px] text-muted-foreground">
                  Stan po przeliczeniu
                </div>

                {props.approved ? (
                  <div className="rounded-xl border border-border bg-background/20 px-3 py-2 text-sm">
                    <span className="text-muted-foreground">
                      {i.counted_qty ?? "—"}
                      {unit ? ` ${unit}` : ""}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      inputMode="decimal"
                      defaultValue={i.counted_qty ?? ""}
                      onBlur={(e) =>
                        props.onQtyBlur?.(i.material_id, e.currentTarget.value)
                      }
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                    />
                    {unit ? (
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                        {unit}
                      </span>
                    ) : null}
                  </div>
                )}

                <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground">
                  <span>Różnica</span>
                  <span className="text-foreground">
                    {diff === null ? "—" : fmtDiff(diff)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* DESKTOP: tabela */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="border-b border-border text-muted-foreground">
            <tr>
              <th className="px-2 py-2 text-left">Materiał</th>
              <th className="px-2 py-2 text-left whitespace-nowrap">
                Stan w systemie
              </th>
              <th className="px-2 py-2 text-left whitespace-nowrap">
                Stan po przeliczeniu
              </th>
              <th className="px-2 py-2 text-left whitespace-nowrap">Różnica</th>
              {!props.approved && <th className="px-2 py-2 text-left" />}
            </tr>
          </thead>

          <tbody>
            {rows.map((i) => {
              const diff =
                i.counted_qty !== null ? i.counted_qty - i.system_qty : null;
              const unit = i.material_unit ?? "";

              return (
                <tr
                  key={i.item_id}
                  className="border-b border-border hover:bg-background/20 transition"
                >
                  <td className="px-2 py-2 max-w-[520px] truncate">
                    {i.material_title}
                  </td>

                  <td className="px-2 py-2 whitespace-nowrap">
                    {i.system_qty}
                    {unit ? ` ${unit}` : ""}
                  </td>

                  <td className="px-2 py-2 whitespace-nowrap">
                    {props.approved ? (
                      <span className="text-muted-foreground">
                        {i.counted_qty ?? "—"}
                        {unit ? ` ${unit}` : ""}
                      </span>
                    ) : (
                      <div className="inline-flex items-center gap-2">
                        <input
                          type="number"
                          inputMode="decimal"
                          defaultValue={i.counted_qty ?? ""}
                          onBlur={(e) =>
                            props.onQtyBlur?.(
                              i.material_id,
                              e.currentTarget.value
                            )
                          }
                          className="w-28 rounded-md border border-border bg-background px-2 py-1"
                        />
                        {unit ? (
                          <span className="text-[11px] text-muted-foreground">
                            {unit}
                          </span>
                        ) : null}
                      </div>
                    )}
                  </td>

                  <td className="px-2 py-2 whitespace-nowrap">
                    {diff === null ? "—" : fmtDiff(diff)}
                  </td>

                  {!props.approved && (
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        onClick={() => props.onRemove?.(i.material_id)}
                        className="rounded-md border border-red-500/40 bg-red-500/10 px-2 py-1 text-[11px] text-red-300 hover:bg-red-500/15 active:bg-red-500/20 transition"
                      >
                        Usuń
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>

        {props.items.length > props.visible && (
          <div className="pt-2 text-[11px] text-muted-foreground">
            Pokazujesz {props.visible} z {props.items.length} pozycji
          </div>
        )}
      </div>
    </div>
  );
}
