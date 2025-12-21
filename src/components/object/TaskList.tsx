// src/components/object/TaskList.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import TaskStatusBadge from "./TaskStatusBadge";
import { updateTaskCrew, softDeleteTask } from "@/app/(app)/object/actions";

export type TaskRow = {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "done";
  assigned_crew_id: string | null;
  crew_name?: string | null; // legacy
};

type CrewOption = {
  id: string;
  name: string;
};

type Props = {
  tasks: TaskRow[];
  crewOptions: CrewOption[];
};

export default function TaskList({ tasks, crewOptions }: Props) {
  const router = useRouter();
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);

  if (!tasks || tasks.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 bg-card/40 px-4 py-3 text-xs text-muted-foreground">
        Brak zadań w tym miejscu. Dodaj pierwsze zadanie, aby rozpocząć planowanie
        prac.
      </div>
    );
  }

  async function handleChangeCrew(taskId: string, crewId: string) {
    setPendingTaskId(taskId);
    try {
      await updateTaskCrew(taskId, crewId || null);
      router.refresh();
    } catch (e) {
      console.error(e);
    } finally {
      setPendingTaskId(null);
    }
  }

  async function handleDelete(taskId: string) {
    const ok = window.confirm(
      "Na pewno oznaczyć to zadanie jako usunięte? (soft delete)"
    );
    if (!ok) return;

    setPendingTaskId(taskId);
    try {
      await softDeleteTask(taskId);
      router.refresh();
    } catch (e) {
      console.error(e);
    } finally {
      setPendingTaskId(null);
    }
  }

  function openTask(taskId: string) {
    router.push(`/tasks/${taskId}`);
  }

  return (
    <ul className="space-y-2">
      {tasks.map((task) => {
        const isPending = pendingTaskId === task.id;

        const crewSelectValue = task.assigned_crew_id ?? "";
        const crew =
          task.assigned_crew_id &&
          crewOptions.find((c) => c.id === task.assigned_crew_id);

        return (
          <li key={task.id}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => openTask(task.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") openTask(task.id);
              }}
              className={[
                "group rounded-2xl border border-border/70 bg-card/60 shadow-sm",
                "transition hover:bg-card/80 hover:border-border",
                "cursor-pointer select-none",
                "focus:outline-none focus:ring-2 focus:ring-primary/25",
                isPending ? "opacity-80" : "",
              ].join(" ")}
              title="Otwórz zadanie"
            >
              <div className="flex items-start justify-between gap-3 px-4 py-3">
                {/* LEWA */}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold tracking-tight text-foreground">
                    {task.title}
                  </div>

                  {/* META: smukłe “kafelki” jak w crew */}
                  <div
                    className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Brygada */}
                    {crewOptions.length > 0 ? (
                      <div className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-background/40 px-3 py-1">
                        <span className="opacity-80">Brygada</span>
                        <span className="opacity-50">·</span>
                        <select
                          className="bg-transparent text-[11px] text-foreground/80 outline-none cursor-pointer"
                          value={crewSelectValue}
                          disabled={isPending}
                          onChange={(e) => handleChangeCrew(task.id, e.target.value)}
                          title="Zmień brygadę"
                        >
                          <option value="">— brak —</option>
                          {crewOptions.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-background/40 px-3 py-1">
                        <span className="opacity-80">Brygada</span>
                        <span className="opacity-50">·</span>
                        <span className="font-medium text-foreground/85">
                          {crew ? crew.name : "—"}
                        </span>
                      </div>
                    )}

                    {/* ID krótko */}
                    <div className="hidden sm:inline-flex items-center gap-2 rounded-xl border border-border/70 bg-background/40 px-3 py-1">
                      <span className="opacity-80">ID</span>
                      <span className="opacity-50">·</span>
                      <span className="font-mono text-foreground/80">
                        {task.id.slice(0, 8)}…
                      </span>
                    </div>
                  </div>
                </div>

                {/* PRAWA */}
                <div
                  className="shrink-0 flex flex-col items-end gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <TaskStatusBadge status={task.status} />

                  <button
                    type="button"
                    onClick={() => handleDelete(task.id)}
                    disabled={isPending}
                    className={[
                      "rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-1",
                      "text-[11px] font-medium text-rose-200",
                      "transition hover:bg-rose-500/15",
                      "disabled:cursor-not-allowed disabled:opacity-60",
                    ].join(" ")}
                    title="Soft delete"
                  >
                    {isPending ? "Przetwarzanie…" : "Usuń"}
                  </button>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
