// src/components/tasks/MyTasksTable.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import TaskStatusBadge, { type TaskStatus } from "@/components/object/TaskStatusBadge";

export type MyTaskRow = {
  id: string;
  title: string;
  status: TaskStatus;
  placeId: string | null;
  placeName: string | null;

  crewName?: string | null;
  assigneeName?: string | null;
};

type Props = {
  tasks: MyTaskRow[];
  isManager: boolean;
};

function text(v: unknown): string {
  return (v == null ? "" : String(v)).trim();
}

export default function MyTasksTable({ tasks, isManager }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tasks;

    return tasks.filter((task) => {
      const haystack = [task.title, task.placeName, task.crewName, task.assigneeName]
        .filter(Boolean)
        .map((v) => String(v).toLowerCase());

      return haystack.some((t) => t.includes(q));
    });
  }, [tasks, query]);

  const emptyText = isManager
    ? "Brak zadań w projekcie. Dodaj zadania z poziomu Obiektu."
    : "Nie masz jeszcze żadnych zadań przypisanych do Ciebie ani Twojej brygady.";

  return (
    <div className="space-y-3">
      <SearchBar
        query={query}
        setQuery={setQuery}
        disabled={!tasks || tasks.length === 0}
        isManager={isManager}
      />

      {(!tasks || tasks.length === 0) && (
        <div className="text-xs text-foreground/60 border border-dashed border-border/60 rounded-lg px-3 py-3">
          {emptyText}
        </div>
      )}

      {tasks && tasks.length > 0 && (
        <div className="space-y-2">
          {/* Header kolumn – WYRAŹNY */}
          <div className="hidden sm:grid sm:grid-cols-[1.4fr_1fr_1.1fr_auto] gap-3 px-4 py-2 rounded-xl border border-border/60 bg-card/70">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-foreground/60">
              Zadanie
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-foreground/60">
              Miejsce
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-foreground/60">
              Brygada / osoba
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-foreground/60 text-right">
              Status
            </div>
          </div>

          {/* Lista – ODERWANE POZYCJE */}
          <div className="space-y-2">
            {filtered.map((task) => {
              const title = text(task.title) || "(bez tytułu)";
              const place = text(task.placeName) || "(brak miejsca)";
              const person = text(task.assigneeName);
              const crew = text(task.crewName);

              // pokazujemy obie informacje gdy są
              const assignPieces = [
                person ? `Osoba: ${person}` : "",
                crew ? `Brygada: ${crew}` : "",
              ].filter(Boolean);

              const assignText = assignPieces.length > 0 ? assignPieces.join(" • ") : "(nie przypisano)";

              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => router.push(`/tasks/${task.id}`)}
                  className="w-full text-left rounded-xl border border-border/60 bg-card/60 hover:bg-card/85 transition px-4 py-3"
                >
                  {/* desktop row */}
                  <div className="hidden sm:grid sm:grid-cols-[1.4fr_1fr_1.1fr_auto] gap-3 items-center">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground truncate">{title}</div>
                    </div>

                    <div className="min-w-0">
                      <div className="text-xs text-foreground/80 truncate">{place}</div>
                    </div>

                    <div className="min-w-0">
                      <div className="text-xs text-foreground/80 truncate">{assignText}</div>
                    </div>

                    <div className="flex justify-end">
                      <TaskStatusBadge status={task.status} />
                    </div>
                  </div>

                  {/* mobile stacked */}
                  <div className="sm:hidden space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-foreground">{title}</div>
                        <div className="text-xs text-foreground/70 mt-0.5">{place}</div>
                      </div>
                      <TaskStatusBadge status={task.status} />
                    </div>

                    <div className="text-[11px] text-foreground/70">
                      <span className="text-foreground/50">Przypisanie:</span>{" "}
                      <span className="text-foreground/85">{assignText}</span>
                    </div>
                  </div>
                </button>
              );
            })}

            {filtered.length === 0 && (
              <div className="text-xs text-foreground/60 border border-dashed border-border/60 rounded-lg px-3 py-3">
                Brak zadań pasujących do filtra.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                              SearchBar – UI                                */
/* -------------------------------------------------------------------------- */

type SearchBarProps = {
  query: string;
  setQuery: (v: string) => void;
  disabled: boolean;
  isManager: boolean;
};

function SearchBar({ query, setQuery, disabled, isManager }: SearchBarProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex-1 max-w-xl">
        <label className="block text-[11px] font-medium text-foreground/60 mb-1">
          Wyszukaj zadanie
        </label>
        <input
          type="text"
          value={query}
          disabled={disabled}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            isManager
              ? "Szukaj po tytule, miejscu, osobie lub brygadzie…"
              : "Szukaj po tytule lub miejscu…"
          }
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-foreground/40 disabled:opacity-50"
        />
        <div className="mt-1 text-[11px] text-foreground/50">
          Wpisujesz → lista filtruje się od razu.
        </div>
      </div>
    </div>
  );
}
