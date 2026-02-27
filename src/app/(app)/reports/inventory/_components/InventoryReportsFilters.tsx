// src/app/(app)/reports/inventory/_components/InventoryReportsFilters.tsx
"use client";

type Props = {
  from: string;
  to: string;
  q: string;

  onChangeFrom: (v: string) => void;
  onChangeTo: (v: string) => void;
  onChangeQ: (v: string) => void;

  onClear: () => void;

  // styl przycisku (kanon z deliveries)
  btnGhostClass: string;
};

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export default function InventoryReportsFilters({
  from,
  to,
  q,
  onChangeFrom,
  onChangeTo,
  onChangeQ,
  onClear,
  btnGhostClass,
}: Props) {
  return (
    <div className="grid gap-3 md:grid-cols-12">
      <label className="grid gap-1 md:col-span-3">
        <span className="text-xs opacity-70">Od</span>
        <input
          type="date"
          value={from}
          onChange={(e) => onChangeFrom(e.target.value)}
          className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
        />
      </label>

      <label className="grid gap-1 md:col-span-3">
        <span className="text-xs opacity-70">Do</span>
        <input
          type="date"
          value={to}
          onChange={(e) => onChangeTo(e.target.value)}
          className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
        />
      </label>

      <label className="grid gap-1 md:col-span-6">
        <span className="text-xs opacity-70">Szukaj</span>
        <input
          value={q}
          onChange={(e) => onChangeQ(e.target.value)}
          placeholder="kto / opis / lokalizacja…"
          className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
        />
      </label>

      <div className="md:col-span-12 flex items-center justify-end gap-2 pt-1 pr-1">
        <button type="button" onClick={onClear} className={cls(btnGhostClass, "mr-1")}>
          Wyczyść
        </button>
      </div>
    </div>
  );
}