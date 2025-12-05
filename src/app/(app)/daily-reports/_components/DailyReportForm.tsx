// src/app/(app)/daily-reports/_components/DailyReportForm.tsx
"use client";

import { useMemo, useState, FormEvent } from "react";
import type { TaskForCrew } from "../page";

type Material = {
  id: string;
  name: string;
  unit: string | null;
};

type DailyReportFormProps = {
  materials: Material[];
  currentMemberId: string | null;
  currentCrewId: string | null;
  tasksForCrew: TaskForCrew[];
};

type ItemRow = {
  materialId: string;
  materialName: string;
  qtyUsed: number;
  note: string;
};

type TaskRowState = {
  taskId: string;
  title: string;
  placeName: string | null;
  done: boolean;
  note: string;
};

export default function DailyReportForm({
  materials,
  currentMemberId,
  currentCrewId,
  tasksForCrew,
}: DailyReportFormProps) {
  // ------------------ stan ogólny raportu ------------------
  const [date, setDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [stageId] = useState<string | null>(null); // na później, teraz null

  // ------------------ MATERIAŁY ------------------
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<ItemRow[]>([]);

  const filteredMaterials = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return materials.slice(0, 10);
    return materials
      .filter((m) => m.name.toLowerCase().includes(q))
      .slice(0, 20);
  }, [materials, query]);

  function addItem(m: Material) {
    setItems((prev) => {
      const idx = prev.findIndex((r) => r.materialId === m.id);
      if (idx >= 0) {
        const clone = [...prev];
        clone[idx] = {
          ...clone[idx],
          qtyUsed: clone[idx].qtyUsed + 1,
        };
        return clone;
      }
      return [
        ...prev,
        {
          materialId: m.id,
          materialName: m.name,
          qtyUsed: 1,
          note: "",
        },
      ];
    });
    setQuery("");
  }

  function updateQty(id: string, qty: number) {
    setItems((prev) =>
      prev.map((r) =>
        r.materialId === id
          ? { ...r, qtyUsed: Math.max(0, qty || 0) }
          : r
      )
    );
  }

  function updateItemNote(id: string, note: string) {
    setItems((prev) =>
      prev.map((r) => (r.materialId === id ? { ...r, note } : r))
    );
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((r) => r.materialId !== id));
  }

  // ------------------ ZADANIA BRYGADY ------------------
  const [tasksState, setTasksState] = useState<TaskRowState[]>(() =>
    tasksForCrew.map((t) => ({
      taskId: t.id,
      title: t.title,
      placeName: t.placeName,
      done: false,
      note: "",
    }))
  );

  function toggleTask(taskId: string, checked: boolean) {
    setTasksState((prev) =>
      prev.map((t) =>
        t.taskId === taskId ? { ...t, done: checked } : t
      )
    );
  }

  function updateTaskNote(taskId: string, note: string) {
    setTasksState((prev) =>
      prev.map((t) => (t.taskId === taskId ? { ...t, note } : t))
    );
  }

  // ------------------ SUBMIT ------------------
  async function onSubmit(e: FormEvent) {
    e.preventDefault();

    if (!currentCrewId) {
      alert(
        "Nie jesteś przypisany do żadnej brygady. Poproś managera o przypisanie."
      );
      return;
    }

    const itemsPayload = items
      .filter((r) => r.qtyUsed > 0)
      .map((r) => ({
        materialId: r.materialId,
        qtyUsed: r.qtyUsed,
        note: r.note || undefined,
      }));

    const completedTasksState = tasksState.filter((t) => t.done);

    const completedTasksPayload = completedTasksState.map((t) => ({
      taskId: t.taskId,
      note: t.note || undefined,
      completedByMemberId: currentMemberId ?? undefined,
      photos: [] as string[], // upload zdjęć zrobimy w kolejnym etapie
    }));

    if (itemsPayload.length === 0 && completedTasksPayload.length === 0) {
      alert(
        "Dodaj zużycie materiałów albo zaznacz przynajmniej jedno zakończone zadanie."
      );
      return;
    }

    const body = {
      date,
      crewId: currentCrewId,
      stageId: stageId ?? null,
      items: itemsPayload,
      completedTasks: completedTasksPayload,
    };

    try {
      const res = await fetch("/api/daily-reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const json = await res.json();

      if (!res.ok) {
        console.error("createDailyReportWithTasks error:", json);
        alert(json.error || "Nie udało się zapisać raportu.");
        return;
      }

      console.log("✅ Raport zapisany:", json);
      alert("Raport dzienny został zapisany.");

      resetForm();
    } catch (err) {
      console.error("createDailyReportWithTasks fetch error:", err);
      alert("Wystąpił błąd sieci przy zapisie raportu.");
    }
  }

  function resetForm() {
    setDate(new Date().toISOString().slice(0, 10));
    setItems([]);
    setQuery("");
    setTasksState(
      tasksForCrew.map((t) => ({
        taskId: t.id,
        title: t.title,
        placeName: t.placeName,
        done: false,
        note: "",
      }))
    );
  }

  // ------------------ RENDER ------------------
  return (
    <form onSubmit={onSubmit} className="space-y-8">
      {/* Sekcja: dane ogólne */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-foreground/70">
            Data raportu
          </span>
          <input
            type="date"
            className="border border-border rounded-lg px-3 py-2 bg-background"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-foreground/70">
            Brygada
          </span>
          <input
            className="border border-border rounded-lg px-3 py-2 bg-muted/40"
            value={currentCrewId ?? ""}
            disabled
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-foreground/70">
            Osoba raportująca
          </span>
          <input
            className="border border-border rounded-lg px-3 py-2 bg-muted/40"
            value={currentMemberId ?? ""}
            disabled
          />
        </label>
      </section>

      {/* Sekcja: materiały */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Zużyte materiały</h2>
          <p className="text-xs text-foreground/60">
            Wpisz, co dzisiaj faktycznie zeszło z magazynu.
          </p>
        </div>

        <div className="relative">
          <input
            className="border border-border rounded-lg px-3 py-2 w-full bg-background"
            placeholder="Szukaj materiału…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <div className="absolute z-20 mt-1 w-full border border-border rounded-lg overflow-hidden bg-card max-h-64 overflow-y-auto">
              {filteredMaterials.length === 0 ? (
                <div className="p-2 text-xs text-foreground/60">
                  Brak wyników.
                </div>
              ) : (
                filteredMaterials.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => addItem(m)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-background/60"
                  >
                    {m.name}
                    {m.unit ? (
                      <span className="text-xs text-foreground/60">
                        {" "}
                        ({m.unit})
                      </span>
                    ) : null}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-3 py-2">Materiał</th>
                  <th className="text-left px-3 py-2 w-32">Ilość</th>
                  <th className="text-left px-3 py-2">Notatka</th>
                  <th className="px-3 py-2 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {items.map((row) => (
                  <tr key={row.materialId}>
                    <td className="px-3 py-2">{row.materialName}</td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        step={0.1}
                        className="w-24 border border-border rounded-lg px-2 py-1 bg-background"
                        value={row.qtyUsed}
                        onChange={(e) =>
                          updateQty(row.materialId, Number(e.target.value))
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        className="w-full border border-border rounded-lg px-2 py-1 bg-background text-xs"
                        placeholder="opcjonalna notatka…"
                        value={row.note}
                        onChange={(e) =>
                          updateItemNote(row.materialId, e.target.value)
                        }
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => removeItem(row.materialId)}
                        className="text-xs px-2 py-1 rounded-lg border border-border hover:bg-background/60"
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

      {/* Sekcja: zadania z obiektu */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Zadania zlecone brygadzie</h2>
          <p className="text-xs text-foreground/60">
            Zaznacz, które taski dziś faktycznie zostały zakończone.
          </p>
        </div>

        {tasksState.length === 0 ? (
          <p className="text-xs text-foreground/60">
            Brak zadań przypisanych do tej brygady.
          </p>
        ) : (
          <div className="space-y-2">
            {tasksState.map((t) => (
              <div
                key={t.taskId}
                className="border border-border rounded-xl px-3 py-2 flex flex-col gap-2 bg-card/60"
              >
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={t.done}
                    onChange={(e) =>
                      toggleTask(t.taskId, e.target.checked)
                    }
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{t.title}</div>
                    {t.placeName && (
                      <div className="text-xs text-foreground/60">
                        Miejsce: {t.placeName}
                      </div>
                    )}
                  </div>
                </label>

                {t.done && (
                  <textarea
                    className="w-full border border-border rounded-lg px-2 py-1 text-xs bg-background"
                    placeholder="Krótka notatka z wykonania (opcjonalnie)…"
                    rows={2}
                    value={t.note}
                    onChange={(e) =>
                      updateTaskNote(t.taskId, e.target.value)
                    }
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Akcje */}
      <div className="flex gap-3">
        <button
          type="submit"
          className="px-4 py-2 rounded-xl border border-border bg-card hover:bg-card/80 text-sm font-medium"
        >
          Zapisz raport dzienny
        </button>
        <button
          type="button"
          onClick={resetForm}
          className="px-4 py-2 rounded-xl border border-border text-sm"
        >
          Wyczyść
        </button>
      </div>
    </form>
  );
}
