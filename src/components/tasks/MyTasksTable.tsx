// src/components/tasks/MyTasksTable.tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import TaskStatusBadge, {
  type TaskStatus,
} from "@/components/object/TaskStatusBadge";

export type MyTaskRow = {
  id: string;
  title: string;
  status: TaskStatus;
  placeId: string | null;
  placeName: string | null;

  // Pod przyszłe rozszerzenia (JOIN na brygadę / osobę):
  crewName?: string | null;
  assigneeName?: string | null;
};

type Props = {
  tasks: MyTaskRow[];
  isManager: boolean;
};

export default function MyTasksTable({ tasks, isManager }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tasks;

    return tasks.filter((task) => {
      const haystack = [
        task.title,
        task.placeName,
        task.crewName,
        task.assigneeName,
      ]
        .filter(Boolean)
        .map((v) => String(v).toLowerCase());

      return haystack.some((text) => text.includes(q));
    });
  }, [tasks, query]);

  if (!tasks || tasks.length === 0) {
    return (
      <div className="space-y-3">
        <SearchBar
          query={query}
          setQuery={setQuery}
          disabled={true}
          isManager={isManager}
        />
        <div className="text-xs text-foreground/60 border border-dashed border-border/60 rounded-lg px-3 py-3">
          {isManager
            ? "Brak zadań w projekcie. Dodaj zadania z poziomu Obiektu."
            : "Nie masz jeszcze żadnych zadań przypisanych do Ciebie ani Twojej brygady."}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <SearchBar
        query={query}
        setQuery={setQuery}
        disabled={false}
        isManager={isManager}
      />

      <div className="overflow-x-auto rounded-lg border border-border/60 bg-card/60">
        <table className="min-w-full text-sm">
          <thead className="border-b border-border/60 bg-card/80">
            <tr>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-foreground/60">
                Zadanie
              </th>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-foreground/60">
                Miejsce
              </th>
              {isManager && (
                <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-foreground/60">
                  Brygada / osoba
                </th>
              )}
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-foreground/60">
                Status
              </th>
              <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-foreground/60">
                Akcje
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((task) => (
              <tr
                key={task.id}
                className="border-t border-border/60 hover:bg-card/90 transition"
              >
                {/* Zadanie */}
                <td className="px-3 py-2 align-middle">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">
                      {task.title}
                    </span>
                  </div>
                </td>

                {/* Miejsce */}
                <td className="px-3 py-2 align-middle">
                  {task.placeName ? (
                    <span className="text-xs text-foreground/80">
                      {task.placeName}
                    </span>
                  ) : (
                    <span className="text-[11px] text-foreground/50">
                      (brak nazwy miejsca)
                    </span>
                  )}
                </td>

                {/* Brygada / osoba – tylko dla managera; na razie placeholder pod przyszłe dane */}
                {isManager && (
                  <td className="px-3 py-2 align-middle">
                    {task.assigneeName || task.crewName ? (
                      <span className="text-xs text-foreground/80">
                        {task.assigneeName ?? task.crewName}
                      </span>
                    ) : (
                      <span className="text-[11px] text-foreground/50">
                        (nie przypisano)
                      </span>
                    )}
                  </td>
                )}

                {/* Status */}
                <td className="px-3 py-2 align-middle">
                  <TaskStatusBadge status={task.status} />
                </td>

                {/* Akcje */}
                <td className="px-3 py-2 align-middle text-right">
                  <Link
                    href={`/tasks/${task.id}`}
                    className="inline-flex items-center rounded-full border border-border/70 px-3 py-1 text-[11px] font-medium text-foreground/80 hover:bg-card hover:text-foreground transition"
                  >
                    Otwórz zadanie →
                  </Link>
                </td>
              </tr>
            ))}

            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={isManager ? 5 : 4}
                  className="px-3 py-4 text-center text-xs text-foreground/60"
                >
                  Brak zadań pasujących do filtra.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex-1 max-w-md">
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
              ? "Szukaj po tytule, miejscu, (później: brygadzie lub osobie)..."
              : "Szukaj po tytule lub miejscu..."
          }
          className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-foreground/40 disabled:opacity-50"
        />
      </div>
    </div>
  );
}
