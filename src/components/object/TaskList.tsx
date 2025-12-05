"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TaskStatusBadge from "./TaskStatusBadge";
import {
  updateTaskCrew,
  softDeleteTask,
} from "@/app/(app)/object/actions";

export type TaskRow = {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "done";
  assigned_crew_id: string | null;
  crew_name?: string | null; // legacy, nie jest wymagane
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
      <div className="text-xs text-foreground/60 border border-dashed border-border/60 rounded-lg px-3 py-3">
        Brak zadań w tym miejscu. Dodaj pierwsze zadanie, aby rozpocząć
        planowanie prac.
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

  return (
    <ul className="space-y-1">
      {tasks.map((task) => {
        const crew =
          task.assigned_crew_id &&
          crewOptions.find((c) => c.id === task.assigned_crew_id);
        const isPending = pendingTaskId === task.id;

        return (
          <li key={task.id}>
            <div className="group flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-sm hover:border-border hover:bg-card transition">
              {/* Lewa część: tytuł + brygada */}
              <div className="flex flex-col gap-1">
                <Link
                  href={`/tasks/${task.id}`}
                  className="font-medium group-hover:underline"
                >
                  {task.title}
                </Link>

                {crewOptions.length > 0 && (
                  <div className="flex items-center gap-2 text-xs text-foreground/70">
                    <span>Brygada:</span>
                    <select
                      className="rounded border border-border bg-background px-1 py-0.5 text-[11px] outline-none"
                      defaultValue={task.assigned_crew_id ?? ""}
                      disabled={isPending}
                      onChange={(e) =>
                        handleChangeCrew(task.id, e.target.value)
                      }
                    >
                      <option value="">— brak przypisania —</option>
                      {crewOptions.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {crewOptions.length === 0 && crew && (
                  <span className="text-xs text-foreground/70">
                    Brygada: {crew.name}
                  </span>
                )}
              </div>

              {/* Prawa część: status + usuń */}
              <div className="flex flex-col items-end gap-1 shrink-0">
                <TaskStatusBadge status={task.status} />

                <button
                  type="button"
                  onClick={() => handleDelete(task.id)}
                  disabled={isPending}
                  className="text-[11px] text-red-400 hover:text-red-300 disabled:opacity-60"
                >
                  {isPending ? "Przetwarzanie..." : "Usuń zadanie"}
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
