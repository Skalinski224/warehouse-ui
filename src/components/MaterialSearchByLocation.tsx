// src/components/MaterialSearchByLocation.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export type MaterialOption = {
  id: string;
  title: string;
  unit: string | null;
  current_quantity: number | null;
};

export default function MaterialSearchByLocation({
  locationId,
  onPick,
  disabled,
}: {
  locationId: string;
  onPick: (m: MaterialOption) => void;
  disabled?: boolean;
}) {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<MaterialOption[]>([]);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    const query = q.trim();
    if (!query) {
      setResults([]);
      setLoading(false);
      setStatus("");
      return;
    }

    setLoading(true);
    setStatus("Szukam…");

    const handle = setTimeout(async () => {
      const { data, error } = await supabase
        .from("v_materials_overview_loc")
        .select("id,title,unit,current_quantity,deleted_at,inventory_location_id")
        .eq("inventory_location_id", locationId)
        .is("deleted_at", null)
        // jeśli chcesz tylko te “na stanie” od razu:
        .gt("current_quantity", 0)
        .ilike("title", `%${query}%`)
        .order("title", { ascending: true })
        .limit(30);

      if (error) {
        console.warn("MaterialSearchByLocation: error:", error);
        setResults([]);
        setStatus("Błąd pobierania wyników.");
        setLoading(false);
        return;
      }

      const mapped = ((data ?? []) as any[]).map((m) => ({
        id: String(m.id),
        title: String(m.title),
        unit: (m.unit as string) ?? null,
        current_quantity:
          typeof m.current_quantity === "number" ? m.current_quantity : null,
      })) as MaterialOption[];

      setResults(mapped);
      setLoading(false);
      setStatus(mapped.length === 0 ? `Brak wyników dla „${query}”.` : "");
    }, 250);

    return () => clearTimeout(handle);
  }, [q, locationId, supabase]);

  return (
    <div className="grid gap-2">
      <label className="text-sm">Szukaj materiału (tylko z tej lokalizacji)</label>
      <input
        type="text"
        placeholder="Wpisz nazwę…"
        className="h-10 border border-border bg-background rounded px-3 disabled:opacity-60"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        disabled={disabled}
      />

      <div className="text-[11px] opacity-70 min-h-[16px]">
        {loading ? "Szukam…" : status}
      </div>

      {results.length > 0 && (
        <div className="rounded-xl border border-border bg-background/20 p-2 space-y-1 max-h-52 overflow-auto">
          {results.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                onPick(m);
                setQ("");
                setResults([]);
                setStatus("");
              }}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-background/40 transition flex items-center justify-between gap-2"
            >
              <span className="truncate">{m.title}</span>
              <span className="text-[11px] opacity-70 border border-border rounded px-2 py-1 bg-card">
                {m.unit ?? "—"} · stan: {m.current_quantity ?? "?"}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
