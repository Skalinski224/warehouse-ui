"use client";

import { useEffect, useMemo, useState, FormEvent } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type BaseVals = {
  id?: string;
  title?: string;
  description?: string | null;
  unit?: string;
  base_quantity?: number | string;
  current_quantity?: number | string;
  cta_url?: string | null;
  image_url?: string | null;

  // ✅ lokacje (nowe)
  inventory_location_id?: string | null;
  inventory_location_label?: string | null;
};

type Props = {
  /** Server Action (np. createMaterial albo saveMaterial/updateMaterial) */
  action: (formData: FormData) => Promise<any>;
  /** Wartości początkowe (dla edycji) */
  initial?: BaseVals;
  /** 'create' (domyślnie) lub 'edit' – wpływa na etykiety */
  mode?: "create" | "edit";
  /** Po udanym submit (opcjonalnie zamknij dialog, pokaż toast itp.) */
  onSubmitted?: () => void;
  /** Klasy zewnętrzne kontenera formularza */
  className?: string;
  /** Tekst przycisku submit (nadpisuje dom yślne) */
  submitLabel?: string;
};

/**
 * MaterialForm – formularz Dodaj/Edytuj materiał.
 * Pola:
 *  - miniatura (image – opcjonalnie, wysyłana razem z formą)
 *  - title (wymagane)
 *  - description (opcjonalnie)
 *  - unit (domyślnie 'szt')
 *  - base_quantity (wymagane)
 *  - current_quantity (opcjonalnie)
 *  - inventory_location_id / inventory_location_label (NOWE)
 *  - cta_url (opcjonalnie)
 *
 * Uwaga: przy dużych plikach rozważ upload po stronie klienta + przekazywanie samego URL.
 */
export default function MaterialForm({
  action,
  initial,
  mode = "create",
  onSubmitted,
  className = "",
  submitLabel,
}: Props) {
  const [submitting, setSubmitting] = useState(false);

  // 🔹 Lokacje
  const [locations, setLocations] = useState<{ id: string; label: string }[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  const [newLocation, setNewLocation] = useState("");

  const isEdit = mode === "edit";

  // fetch lokacji (bez crashy)
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const sb = supabaseBrowser();
        const { data, error } = await sb
          .from("inventory_locations")
          .select("id,label")
          .is("deleted_at", null)
          .order("label", { ascending: true });

        if (!alive) return;
        if (error) {
          console.warn("[MaterialForm] inventory_locations fetch error:", error);
          return;
        }
        if (Array.isArray(data)) setLocations(data as any);
      } catch (e) {
        console.warn("[MaterialForm] inventory_locations fetch exception:", e);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  // domyślny wybór lokacji (ładny UX)
  const defaultLocationId = useMemo(() => {
    // 1) jeśli edycja i jest ustawione ID — bierzemy to
    if (initial?.inventory_location_id) return String(initial.inventory_location_id);

    // 2) jeśli istnieje lokacja "Magazyn" — bierzemy ją
    const magazyn = locations.find(
      (l) => (l.label ?? "").trim().toLowerCase() === "magazyn"
    );
    if (magazyn?.id) return magazyn.id;

    // 3) fallback: pierwsza lokacja
    if (locations[0]?.id) return locations[0].id;

    // 4) brak — pusty
    return "";
  }, [initial?.inventory_location_id, locations]);

  // ustaw selectedLocationId po załadowaniu listy / zmianie initial
  useEffect(() => {
    // jeśli edycja ma label, ale nie ma id (albo id nie pasuje) — traktujemy jako NOWA
    const initId = (initial?.inventory_location_id ?? "") as any;
    const initLabel = (initial?.inventory_location_label ?? "") as any;

    if (initId) {
      setSelectedLocationId(String(initId));
      setNewLocation("");
      return;
    }

    if (initLabel && String(initLabel).trim()) {
      setSelectedLocationId("__new__");
      setNewLocation(String(initLabel));
      return;
    }

    setSelectedLocationId(defaultLocationId);
    setNewLocation("");
  }, [
    defaultLocationId,
    initial?.inventory_location_id,
    initial?.inventory_location_label,
  ]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    setSubmitting(true);
    onSubmitted?.();
  }

  // co wysyłamy do backendu:
  // - jeśli wybrano istniejącą lokację: inventory_location_id = selected
  // - jeśli "__new__": inventory_location_id = "" oraz inventory_location_label = newLocation
  const shouldShowNewLocationInput = selectedLocationId === "__new__";

  return (
    <form action={action} onSubmit={onSubmit} className={`grid gap-3 ${className}`}>
      {/* ID tylko w trybie edycji */}
      {isEdit && initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}

      {/* Tytuł */}
      <div className="grid gap-2">
        <label className="text-sm">Tytuł *</label>
        <input
          name="title"
          required
          defaultValue={initial?.title ?? ""}
          placeholder="np. Pręt fi10"
          className="border border-border bg-background rounded px-3 py-2"
        />
      </div>

      {/* Opis */}
      <div className="grid gap-2">
        <label className="text-sm">Opis</label>
        <textarea
          name="description"
          rows={3}
          defaultValue={initial?.description ?? ""}
          placeholder="Krótki opis (opcjonalnie)"
          className="border border-border bg-background rounded px-3 py-2"
        />
      </div>

      {/* Jednostka / Baza / Stan */}
      <div className="grid grid-cols-3 gap-3">
        <div className="grid gap-2">
          <label className="text-sm">Jednostka</label>
          <input
            name="unit"
            defaultValue={initial?.unit ?? "szt"}
            className="border border-border bg-background rounded px-3 py-2"
          />
        </div>
        <div className="grid gap-2">
          <label className="text-sm">Baza *</label>
          <input
            type="number"
            step="0.01"
            name="base_quantity"
            required
            defaultValue={
              initial?.base_quantity !== undefined ? Number(initial.base_quantity) : undefined
            }
            placeholder="100"
            className="border border-border bg-background rounded px-3 py-2"
          />
        </div>
        <div className="grid gap-2">
          <label className="text-sm">Stan</label>
          <input
            type="number"
            step="0.01"
            name="current_quantity"
            defaultValue={
              initial?.current_quantity !== undefined ? Number(initial.current_quantity) : 0
            }
            placeholder="0"
            className="border border-border bg-background rounded px-3 py-2"
          />
        </div>
      </div>

      {/* ✅ Lokacja (ładny select + NOWA na górze) */}
      <div className="grid gap-2">
        <label className="text-sm">Lokacja</label>

        <div className="grid gap-2">
          <div className="relative">
            <select
              name="inventory_location_id"
              value={selectedLocationId === "__new__" ? "" : selectedLocationId}
              onChange={(e) => {
                const v = e.target.value;
                // specjalna opcja NOWA jest renderowana jako value="__new__" ale
                // do payloadu inventory_location_id dajemy "" (żeby backend nie myślał że to uuid)
                if (v === "__new__") {
                  setSelectedLocationId("__new__");
                  if (!newLocation) setNewLocation("");
                  return;
                }
                setSelectedLocationId(v);
                setNewLocation("");
              }}
              className="w-full border border-border bg-background rounded px-3 py-2 pr-10 appearance-none"
            >
              <option value="__new__">NOWA — dodaj lokację…</option>
              <option disabled value="">
                ─────────────
              </option>
              <option value="">—</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.label}
                </option>
              ))}
            </select>

            {/* strzałeczka po prawej (czytelny sygnał, że rozwijane) */}
            <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-foreground/60">
              ▾
            </div>
          </div>

          {/* Hidden input sterujący trybem NOWA (backend dostanie label) */}
          {shouldShowNewLocationInput ? (
            <input
              type="text"
              placeholder="Wpisz nazwę nowej lokacji…"
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
              name="inventory_location_label"
              className="border border-border bg-background rounded px-3 py-2"
            />
          ) : (
            // żeby backend nie dostawał starych wartości przy przełączaniu
            <input type="hidden" name="inventory_location_label" value="" />
          )}
        </div>

        <p className="text-[11px] opacity-70">
          Wybierz istniejącą lokację albo dodaj nową (NOWA).
        </p>
      </div>

      {/* CTA URL */}
      <div className="grid gap-2">
        <label className="text-sm">CTA URL</label>
        <input
          name="cta_url"
          type="url"
          defaultValue={initial?.cta_url ?? ""}
          placeholder="https://sklep.example.com/produkt"
          className="border border-border bg-background rounded px-3 py-2"
        />
      </div>

      {/* Miniaturka (opcjonalnie) */}
      <div className="grid gap-2">
        <label className="text-sm">Miniaturka (opcjonalnie)</label>
        <input
          type="file"
          name="image"
          accept="image/*"
          className="border border-border bg-background rounded px-3 py-2"
        />
        <p className="text-[11px] opacity-70">
          Uwaga: duże pliki mogą przekroczyć limit Server Actions. Jeśli to problem,
          rozważ upload do bucketa po stronie klienta i przekazanie samego URL.
        </p>
      </div>

      {/* Przyciski */}
      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          disabled={submitting}
          className="px-3 py-2 rounded border border-border bg-card hover:bg-card/80"
        >
          {submitLabel ?? (isEdit ? "Zapisz zmiany" : "Dodaj")}
        </button>
      </div>
    </form>
  );
}
