// src/components/DailyReportForm.tsx
"use client";

import React, { useMemo, useState } from "react";

type Material = { id: string | number; name: string; unit?: string | null };
type Coworker = { id: string | number; name: string };

type Props = {
  materials: Material[];
  coworkersOptions?: Coworker[]; // opcjonalne – domyślnie []
};

type ItemRow = {
  material_id: number | string | null;
  material_name: string;
  quantity_used: number;
};

export default function DailyReportForm({
  materials,
  coworkersOptions = [],
}: Props) {
  // --- Formularz: pola główne ---
  const [reporter, setReporter] = useState("");
  const [crew, setCrew] = useState<"A" | "B" | "C" | "">("");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [placeId, setPlaceId] = useState<string>("");
  const [taskName, setTaskName] = useState<string>("");

  // === WSPÓŁPRACOWNICY (multi-select z wyszukiwarką) ===
  const [coworkersQuery, setCoworkersQuery] = useState("");
  const [coworkersSelected, setCoworkersSelected] = useState<Coworker[]>([]);

  const coworkersFiltered = useMemo(() => {
    const q = coworkersQuery.trim().toLowerCase();
    const base = q
      ? coworkersOptions.filter((c) => c.name.toLowerCase().includes(q))
      : coworkersOptions;
    const selectedIds = new Set(coworkersSelected.map((c) => c.id));
    return base.filter((c) => !selectedIds.has(c.id)).slice(0, 20);
  }, [coworkersOptions, coworkersQuery, coworkersSelected]);

  function addCoworker(c: Coworker) {
    setCoworkersSelected((prev) => [...prev, c]);
    setCoworkersQuery("");
  }
  function removeCoworker(id: Coworker["id"]) {
    setCoworkersSelected((prev) => prev.filter((c) => c.id !== id));
  }

  // --- Materiały (dynamiczne wiersze) ---
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<ItemRow[]>([]);

  // --- Zdjęcia (max 3) ---
  const [photos, setPhotos] = useState<File[]>([]);

  // --- Checkboxy ---
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [noPhotosIfInProgress, setNoPhotosIfInProgress] = useState<boolean>(false);

  // Prosta wyszukiwarka materiałów po nazwie
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return materials.slice(0, 10);
    return materials.filter((m) => m.name?.toLowerCase().includes(q)).slice(0, 20);
  }, [materials, query]);

  function addItem(m: Material) {
    setItems((prev) => {
      const idx = prev.findIndex((r) => r.material_id === m.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], quantity_used: copy[idx].quantity_used + 1 };
        return copy;
      }
      return [...prev, { material_id: m.id, material_name: m.name, quantity_used: 1 }];
    });
    setQuery("");
  }

  function updateQty(id: ItemRow["material_id"], qty: number) {
    setItems((prev) =>
      prev.map((r) => (r.material_id === id ? { ...r, quantity_used: Math.max(0, qty) } : r))
    );
  }

  function removeItem(id: ItemRow["material_id"]) {
    setItems((prev) => prev.filter((r) => r.material_id !== id));
  }

  function onPhotosChange(files: FileList | null) {
    if (!files) return;
    const list = Array.from(files);
    const merged = [...photos, ...list].slice(0, 3); // max 3
    setPhotos(merged);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Walidacja
    if (!reporter.trim()) return alert("Podaj imię i nazwisko raportującego.");
    if (!crew) return alert("Wybierz brygadę.");
    if (!date) return alert("Wybierz datę.");
    if (!placeId) return alert("Wybierz miejsce na obiekcie.");
    if (!taskName.trim()) return alert("Podaj krótką nazwę zadania.");
    if (!items.length) return alert("Dodaj przynajmniej jeden materiał.");
    // Jeśli w toku → zdjęcia lub checkbox
    if (!isCompleted && !noPhotosIfInProgress && photos.length === 0) {
      return alert("Zadanie w toku: dodaj zdjęcia albo zaznacz „bez zdjęcia jeśli w toku”.");
    }

    // TODO: (opcjonalnie) sprawdzenie duplikatu (crew+date) przez SELECT/RPC

    const payload = {
      reporter,
      crew,
      date,
      coworkers: coworkersSelected.map((c) => c.name), // lub ID: c.id
      place_id: placeId,
      task_name: taskName,
      items,
      is_completed: isCompleted,
      no_photos_if_in_progress: noPhotosIfInProgress,
      photos_count: photos.length, // (na razie nie uploadujemy)
    };

    console.log("SUBMIT:", payload);
    alert("Wysłano raport (mock). Tu podłączymy zapis do Supabase.");
    resetForm();
  }

  function resetForm() {
    setReporter("");
    setCrew("");
    setDate(new Date().toISOString().slice(0, 10));
    setPlaceId("");
    setTaskName("");
    setItems([]);
    setPhotos([]);
    setIsCompleted(false);
    setNoPhotosIfInProgress(false);
    setQuery("");
    setCoworkersSelected([]);
    setCoworkersQuery("");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Dane ogólne */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-500">Imię i nazwisko raportującego</span>
          <input
            className="border rounded p-2"
            value={reporter}
            onChange={(e) => setReporter(e.target.value)}
            placeholder="Jan Kowalski"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-500">Brygada</span>
          <select
            className="border rounded p-2"
            value={crew}
            onChange={(e) => setCrew(e.target.value as any)}
          >
            <option value="">— wybierz —</option>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-500">Data</span>
          <input
            type="date"
            className="border rounded p-2"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>

        {/* Współpracownicy — multi-select */}
        <section className="md:col-span-2 space-y-2">
          <label className="text-sm text-gray-500">Współpracownicy</label>

          {coworkersSelected.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {coworkersSelected.map((c) => (
                <span
                  key={c.id}
                  className="inline-flex items-center gap-2 px-2 py-1 text-sm rounded-full border
                             bg-zinc-100 dark:bg-zinc-800"
                >
                  {c.name}
                  <button
                    type="button"
                    onClick={() => removeCoworker(c.id)}
                    className="text-xs px-1 py-0.5 border rounded"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="relative">
            <input
              className="border rounded p-2 w-full bg-transparent"
              placeholder="Szukaj osoby…"
              value={coworkersQuery}
              onChange={(e) => setCoworkersQuery(e.target.value)}
            />
            {coworkersQuery && (
              <div
                className="absolute z-10 mt-1 w-full border rounded overflow-hidden
                           bg-white dark:bg-zinc-900"
              >
                {coworkersFiltered.length === 0 ? (
                  <div className="p-2 text-sm text-gray-500">Brak wyników.</div>
                ) : (
                  coworkersFiltered.map((c) => (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => addCoworker(c)}
                      className="w-full text-left p-2 hover:bg-gray-50 dark:hover:bg-zinc-800"
                    >
                      {c.name}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </section>

        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-sm text-gray-500">Miejsce na obiekcie</span>
          <select
            className="border rounded p-2"
            value={placeId}
            onChange={(e) => setPlaceId(e.target.value)}
          >
            <option value="">— wybierz —</option>
            {/* TODO: podłącz do /app/object */}
            <option value="plac-a">Plac A</option>
            <option value="plac-b">Plac B</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-sm text-gray-500">Krótka nazwa zadania</span>
          <input
            className="border rounded p-2"
            value={taskName}
            onChange={(e) => setTaskName(e.target.value)}
            placeholder="Montaż profili..."
          />
        </label>
      </section>

      {/* Materiały */}
      <section className="space-y-3">
        <div className="relative">
          <input
            className="border rounded p-2 w-full bg-transparent"
            placeholder="Szukaj materiału…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <div
              className="absolute z-10 mt-1 w-full border rounded overflow-hidden
                         bg-white dark:bg-zinc-900"
            >
              {filtered.length === 0 && (
                <div className="p-2 text-sm text-gray-500">Brak wyników.</div>
              )}
              {filtered.map((m) => (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => addItem(m)}
                  className="w-full text-left p-2 hover:bg-gray-50 dark:hover:bg-zinc-800"
                >
                  {m.name} {m.unit ? `(${m.unit})` : ""}
                </button>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="border rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-zinc-900">
                <tr>
                  <th className="text-left p-2">Materiał</th>
                  <th className="text-left p-2">Ilość</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200/50 dark:divide-zinc-800">
                {items.map((row) => (
                  <tr key={row.material_id} className="border-t">
                    <td className="p-2">{row.material_name}</td>
                    <td className="p-2">
                      <input
                        type="number"
                        min={0}
                        className="border rounded p-1 w-24 bg-transparent"
                        value={row.quantity_used}
                        onChange={(e) => updateQty(row.material_id, Number(e.target.value))}
                      />
                    </td>
                    <td className="p-2 text-right">
                      <button
                        type="button"
                        onClick={() => removeItem(row.material_id)}
                        className="px-2 py-1 border rounded"
                      >
                        Usuń
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Zdjęcia */}
      <section className="space-y-2">
        <div className="text-sm text-gray-500">Zdjęcia (max 3)</div>
        <input type="file" accept="image/*" multiple onChange={(e) => onPhotosChange(e.target.files)} />
        {photos.length > 0 && (
          <div className="text-sm text-gray-500">
            Wybrane pliki: {photos.map((f) => f.name).join(", ")}
          </div>
        )}
      </section>

      {/* Checkboxy */}
      <section className="space-y-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isCompleted}
            onChange={(e) => setIsCompleted(e.target.checked)}
          />
          <span>Zadanie ukończone</span>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={noPhotosIfInProgress}
            onChange={(e) => setNoPhotosIfInProgress(e.target.checked)}
          />
          <span>Bez zdjęcia jeśli w toku</span>
        </label>
      </section>

      {/* Akcje */}
      <div className="flex gap-3">
        <button type="submit" className="px-4 py-2 border rounded">
          Zapisz raport
        </button>
        <button type="button" className="px-4 py-2 border rounded" onClick={resetForm}>
          Wyczyść
        </button>
      </div>
    </form>
  );
}
