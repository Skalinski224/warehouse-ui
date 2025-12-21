// src/components/daily-reports/sections/DailyReportTaskSection.tsx
"use client";

import { useEffect, useMemo } from "react";
import type { TaskOption } from "@/lib/dto";
import type { NewDailyReportPayload } from "@/app/(app)/daily-reports/actions";

type Props = {
  formState: NewDailyReportPayload;
  setFormState: React.Dispatch<React.SetStateAction<NewDailyReportPayload>>;
  tasks: TaskOption[];
  currentMemberId: string | null;
};

export default function DailyReportTaskSection({
  formState,
  setFormState,
  tasks,
  currentMemberId,
}: Props) {
  const crewMode = formState.crewMode;

  const filteredTasks = useMemo(() => {
    if (crewMode === "crew") {
      const crewId = formState.mainCrewId;
      if (!crewId) return [];
      return tasks.filter((t) => t.assignedCrewId === crewId);
    }

    // solo + ad_hoc → zadania przypisane do osoby wypełniającej raport
    if (!currentMemberId) return [];
    return tasks.filter((t) => t.assignedMemberId === currentMemberId);
  }, [crewMode, formState.mainCrewId, tasks, currentMemberId]);

  // jeśli zmieni się tryb / brygada i aktualne zadanie nie pasuje do filtra -> reset
  useEffect(() => {
    if (!formState.taskId) return;
    if (!filteredTasks.some((t) => t.id === formState.taskId)) {
      setFormState((prev) => ({ ...prev, taskId: null, taskName: null }));
    }
  }, [filteredTasks, formState.taskId, setFormState]);

  const hasTasks = filteredTasks.length > 0;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">Zadanie</h2>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            Zadanie z listy
          </span>
          <select
            className="rounded-lg border border-border bg-background px-3 py-2"
            value={formState.taskId ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              setFormState((prev) => ({
                ...prev,
                taskId: val || null,
                taskName: null, // nie używamy już ręcznego opisu
              }));
            }}
            disabled={!hasTasks}
          >
            <option value="">– wybierz zadanie –</option>
            {filteredTasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
                {t.placeName ? ` — ${t.placeName}` : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!hasTasks && (
        <p className="text-xs text-muted-foreground">
          {crewMode === "crew"
            ? "Brak zadań przypisanych do tej brygady."
            : "Brak zadań przypisanych do tej osoby."}
        </p>
      )}
    </section>
  );
}
