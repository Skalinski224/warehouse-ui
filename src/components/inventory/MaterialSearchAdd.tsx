// src/components/inventory/MaterialSearchAdd.tsx
"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

type MaterialOption = { id: string; title: string; unit: string | null };

export default function MaterialSearchAdd(props: {
  sessionId: string;
  disabled?: boolean;
  searchMaterials: (q: string) => Promise<{ rows: MaterialOption[] }>;
  addItem: (sessionId: string, materialId: string) => Promise<any>;
  onAdded?: () => void;
}) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<MaterialOption[]>([]);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const disabled = !!props.disabled || isPending;
  const term = q.trim();

  const showDropdown = useMemo(
    () => open && !!term && rows.length > 0 && !disabled,
    [open, term, rows.length, disabled]
  );

  useEffect(() => {
    if (!term || disabled) {
      setRows([]);
      return;
    }

    let alive = true;
    const t = setTimeout(() => {
      props
        .searchMaterials(term)
        .then((r) => {
          if (!alive) return;
          setRows(r.rows ?? []);
          setOpen(true);
        })
        .catch(() => {
          if (!alive) return;
          setRows([]);
          setOpen(false);
        });
    }, 250);

    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [term, disabled, props.searchMaterials]);

  function choose(materialId: string) {
    startTransition(async () => {
      await props.addItem(props.sessionId, materialId);
      setQ("");
      setRows([]);
      setOpen(false);
      props.onAdded?.();
    });
  }

  return (
    <div className="relative w-full sm:w-[320px]">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => {
          if (!disabled && term) setOpen(true);
        }}
        onBlur={() => {
          // dajemy czas na klik w dropdown
          setTimeout(() => setOpen(false), 120);
        }}
        placeholder="Wyszukaj i dodaj materiał…"
        disabled={disabled}
        className={[
          "w-full rounded-md border border-border bg-background px-3 py-2 text-xs",
          "hover:bg-background/30 focus:outline-none focus:ring-2 focus:ring-foreground/15",
          "disabled:opacity-50",
        ].join(" ")}
      />

      {showDropdown && (
        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-md border border-border bg-card shadow-sm">
          <div className="max-h-56 overflow-auto">
            {rows.map((m) => (
              <button
                key={m.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()} // nie gub focus zanim kliknie
                onClick={() => choose(m.id)}
                className="block w-full px-3 py-2 text-left text-xs hover:bg-background/40 active:bg-background/50 transition disabled:opacity-50"
                disabled={isPending}
              >
                <span className="block truncate">{m.title}</span>
                {m.unit ? (
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    Jednostka: {m.unit}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
