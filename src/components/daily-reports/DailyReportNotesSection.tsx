// src/components/daily-reports/DailyReportNotesSection.tsx

"use client";

import type { Dispatch, SetStateAction } from "react";
import type { NewDailyReportPayload } from "@/app/(app)/daily-reports/actions";

type Props = {
  formState: NewDailyReportPayload;
  setFormState: Dispatch<SetStateAction<NewDailyReportPayload>>;
};

export default function DailyReportNotesSection({
  formState,
  setFormState,
}: Props) {
  return (
    <section className="space-y-2 mb-6">
      <label className="text-xs font-semibold">
        Opis / uwagi do dzisiejszej pracy (opcjonalnie)
      </label>

      <textarea
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs min-h-[80px] resize-y"
        placeholder="Np. zmiana planu, problemy na obiekcie, uwagi do zadania..."
        value={formState.notes ?? ""}
        onChange={(e) =>
          setFormState((prev) => ({
            ...prev,
            notes: e.target.value.trim().length > 0 ? e.target.value : null,
          }))
        }
      />
    </section>
  );
}
