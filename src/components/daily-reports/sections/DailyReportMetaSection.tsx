"use client";

import { Dispatch, SetStateAction } from "react";
import type { NewDailyReportPayload } from "@/app/(app)/daily-reports/actions";

type Props = {
  formState: NewDailyReportPayload;
  setFormState: Dispatch<SetStateAction<NewDailyReportPayload>>;
};

export default function DailyReportMetaSection({ formState, setFormState }: Props) {
  return (
    <section className="grid gap-4 md:grid-cols-3">
      {/* Data raportu */}
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">
          Data raportu
        </span>
        <input
          type="date"
          className="rounded-lg border border-border bg-background px-3 py-2"
          value={formState.date}
          onChange={(e) =>
            setFormState((prev) => ({ ...prev, date: e.target.value }))
          }
        />
      </label>

      {/* Osoba wypełniająca */}
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">
          Osoba wypełniająca
        </span>
        <input
          type="text"
          className="rounded-lg border border-border bg-background px-3 py-2"
          value={formState.person}
          onChange={(e) =>
            setFormState((prev) => ({ ...prev, person: e.target.value }))
          }
        />
      </label>

      {/* Trzecia kolumna zostaje pusta (możemy kiedyś coś tu dołożyć) */}
      <div />
    </section>
  );
}
