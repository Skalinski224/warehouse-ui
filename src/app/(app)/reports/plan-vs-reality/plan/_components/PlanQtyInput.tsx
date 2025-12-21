"use client";

import { useEffect, useState } from "react";

type Props = {
  value: number;
  unit: string | null;
  onChange: (qty: number) => Promise<void>;
};

export default function PlanQtyInput({ value, unit, onChange }: Props) {
  const [qty, setQty] = useState<number>(value);
  const [saving, setSaving] = useState(false);

  // ✅ sync z propem, jeśli z zewnątrz przyjdzie nowa wartość (revalidate/refetch)
  useEffect(() => {
    setQty(value);
  }, [value]);

  async function commit() {
    if (qty === value) return;

    setSaving(true);
    try {
      await onChange(qty);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-1 justify-end">
      <input
        type="number"
        className="input w-24 text-right"
        value={qty}
        min={0}
        onChange={(e) => setQty(Number(e.target.value))}
        onBlur={commit}
      />
      {unit && <span className="text-xs text-foreground/60">{unit}</span>}
      {saving && <span className="text-xs">…</span>}
    </div>
  );
}
