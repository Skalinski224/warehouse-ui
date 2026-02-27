// src/app/(app)/inventory/_components/StartInventorySessionModal.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { createInventorySession } from "@/app/(app)/inventory/actions";

type LocationOption = { id: string; label: string };

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function StartInventorySessionModal() {
  const router = useRouter();
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [open, setOpen] = useState(false);

  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(false);

  const [locationOpen, setLocationOpen] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [selectedLocationLabel, setSelectedLocationLabel] = useState("");

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    (async () => {
      setLocationsLoading(true);
      setErrorMsg(null);
      try {
        // ✅ źródło prawdy: v_inventory_locations_picker (tylko wybieralne)
        const { data, error } = await supabase
          .from("inventory_locations")
          .select("id,label,account_id,deleted_at,materials!inner(id,deleted_at)")
          .is("deleted_at", null)
          .is("materials.deleted_at", null)
          .order("label", { ascending: true })
          .limit(500);

        if (error) {
          setLocations([]);
          setErrorMsg("Nie udało się pobrać lokalizacji.");
          return;
        }

        // ✅ FIX: widok może zwracać duplikaty (np. przez joiny) → dedupe po id
        const map = new Map<string, LocationOption>();
        for (const row of data ?? []) {
          const id = String((row as any)?.id ?? "").trim();
          if (!id) continue;

          const label = String((row as any)?.label ?? "").trim();
          const safeLabel = label || "—";

          // preferuj pierwsze wystąpienie (po order("label") i tak jest ok)
          if (!map.has(id)) {
            map.set(id, { id, label: safeLabel });
          }
        }

        setLocations(Array.from(map.values()));
      } finally {
        setLocationsLoading(false);
      }
    })();
  }, [open, supabase]);

  function resetUi() {
    setLocationOpen(false);
    setSelectedLocationId("");
    setSelectedLocationLabel("");
    setSaving(false);
    setErrorMsg(null);
  }

  function close() {
    setOpen(false);
    resetUi();
  }

  function pickLocation(l: LocationOption) {
    setSelectedLocationId(l.id);
    setSelectedLocationLabel(l.label || "—");
    setLocationOpen(false);
    setErrorMsg(null);
  }

  async function start() {
    setErrorMsg(null);

    if (!selectedLocationId) {
      setErrorMsg("Wybierz lokalizację magazynową.");
      return;
    }

    setSaving(true);
    try {
      const { sessionId } = await createInventorySession({
        session_date: todayISO(),
        description: null,
        inventory_location_id: selectedLocationId,
      });

      close();
      router.push(`/inventory/new?session=${sessionId}`);
      router.refresh();
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Nie udało się rozpocząć sesji.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* ✅ trigger na stronie /inventory: ma być prostokątny, biały, spójny z “Kontynuuj” */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-foreground text-background px-4 py-2 text-xs font-semibold hover:bg-foreground/90 transition"
      >
        <span className="text-background/80">+</span>
        Rozpocznij sesję
      </button>

      {open ? (
        <div className="fixed inset-0 z-50">
          {/* backdrop blur */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={close}
            aria-hidden="true"
          />

          {/* modal */}
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div
              className="w-full max-w-[640px] rounded-2xl border border-border bg-card shadow-xl"
              role="dialog"
              aria-modal="true"
            >
              <div className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">Rozpocznij inwentaryzację</div>
                    <div className="text-xs opacity-70 mt-1">
                      Najpierw wybierz lokalizację. Sesja będzie przypięta do tej lokalizacji
                      (tak jak w dostawach).
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={close}
                    className="rounded-xl border border-border bg-background px-3 py-2 text-xs hover:bg-foreground/5 transition"
                  >
                    Zamknij
                  </button>
                </div>

                {/* Location picker (skopiowany UX z deliveries) */}
                <div className="rounded-2xl border border-border bg-background/20 p-4 space-y-2">
                  <div className="grid gap-2 relative">
                    <label className="text-sm">Lokalizacja magazynowa *</label>

                    <button
                      type="button"
                      onClick={() => setLocationOpen((v) => !v)}
                      className="h-10 border border-border bg-background rounded px-3 text-left flex items-center justify-between gap-2"
                      disabled={locationsLoading}
                    >
                      <span className={selectedLocationId ? "text-sm" : "text-sm opacity-70"}>
                        {selectedLocationId ? selectedLocationLabel : "— wybierz lokalizację —"}
                      </span>
                      <span className="text-[11px] opacity-70">
                        {locationsLoading ? "Ładuję…" : "▼"}
                      </span>
                    </button>

                    {locationOpen && (
                      <div className="rounded-xl border border-border bg-background/20 p-2 space-y-1 max-h-[220px] overflow-auto">
                        {locations.length === 0 ? (
                          <div className="text-sm opacity-70 px-2 py-2">
                            Brak lokalizacji na koncie.
                          </div>
                        ) : (
                          locations.map((l) => (
                            <button
                              key={l.id}
                              type="button"
                              onClick={() => pickLocation(l)}
                              className="w-full text-left px-3 py-2 rounded-lg hover:bg-background/40 transition flex items-center justify-between gap-2"
                            >
                              <span className="truncate">{l.label}</span>
                              {selectedLocationId === l.id ? (
                                <span className="text-[11px] opacity-70 border border-border rounded px-2 py-1 bg-card">
                                  wybrano
                                </span>
                              ) : null}
                            </button>
                          ))
                        )}
                      </div>
                    )}

                    <div className="text-[11px] opacity-70 min-h-[16px]">
                      {selectedLocationId ? (
                        <span>Materiały w sesji będą dostępne tylko z tej lokalizacji.</span>
                      ) : (
                        <span>Najpierw wybierz lokalizację.</span>
                      )}
                    </div>
                  </div>
                </div>

                {errorMsg ? (
                  <div className="text-sm text-red-300 border border-red-500/40 rounded-2xl px-3 py-2 bg-red-500/10">
                    {errorMsg}
                  </div>
                ) : null}

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={close}
                    className="px-4 py-2 rounded border border-border bg-card hover:bg-card/80 text-sm transition"
                    disabled={saving}
                  >
                    Anuluj
                  </button>

                  <button
                    type="button"
                    onClick={start}
                    disabled={saving || !selectedLocationId}
                    className="px-4 py-2 rounded border border-border bg-foreground text-background text-sm hover:bg-foreground/90 disabled:opacity-60 disabled:cursor-not-allowed transition"
                  >
                    {saving ? "Tworzę sesję..." : "Rozpocznij sesję"}
                  </button>
                </div>

                <div className="text-[11px] text-muted-foreground">
                  Po rozpoczęciu sesji przejdziesz od razu do edytora i będziesz dodawać tylko
                  materiały z wybranej lokalizacji.
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
