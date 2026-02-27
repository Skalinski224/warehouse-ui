// src/components/InventoryLocationSelect.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type LocationRow = {
  id: string;
  label: string;
  deleted_at: string | null;
};

export default function InventoryLocationSelect({
  value,
  onChange,
  disabled,
  placeholder = "Wybierz lokalizację…",
}: {
  value: string | null;
  onChange: (locationId: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const selectedLabel =
    value ? locations.find((l) => l.id === value)?.label ?? null : null;

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setErr(null);

      const { data, error } = await supabase
        .from("inventory_locations")
        .select("id,label,deleted_at")
        .is("deleted_at", null)
        .order("label", { ascending: true })
        .limit(200);

      if (!alive) return;

      if (error) {
        console.warn("InventoryLocationSelect: fetch error:", error);
        setErr("Nie udało się pobrać lokalizacji.");
        setLocations([]);
      } else {
        setLocations((data ?? []) as any);
      }

      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [supabase]);

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => setOpen((v) => !v)}
        className="h-10 w-full border border-border bg-background rounded px-3 text-left flex items-center justify-between gap-2 disabled:opacity-60"
      >
        <span className={selectedLabel ? "text-sm" : "text-sm opacity-60"}>
          {selectedLabel ?? placeholder}
        </span>
        <span className="text-xs opacity-70">{loading ? "…" : "▼"}</span>
      </button>

      {err ? (
        <div className="text-[11px] mt-1 text-red-300 opacity-90">{err}</div>
      ) : (
        <div className="text-[11px] mt-1 opacity-70 min-h-[16px]">
          {value ? " " : "Wymagane — bez lokalizacji nie dodasz pozycji."}
        </div>
      )}

      {open && !disabled && (
        <div className="absolute z-20 mt-2 w-full rounded-xl border border-border bg-card p-2 max-h-60 overflow-auto shadow-sm">
          {locations.length === 0 ? (
            <div className="text-sm opacity-70 px-2 py-2">
              Brak lokalizacji na koncie.
            </div>
          ) : (
            <div className="space-y-1">
              {locations.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => {
                    onChange(l.id);
                    setOpen(false);
                  }}
                  className={[
                    "w-full text-left px-3 py-2 rounded-lg transition",
                    "hover:bg-background/40",
                    value === l.id ? "bg-background/30" : "",
                  ].join(" ")}
                >
                  <div className="text-sm truncate">{l.label}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
