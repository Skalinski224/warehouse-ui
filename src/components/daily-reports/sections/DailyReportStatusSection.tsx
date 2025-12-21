// src/components/daily-reports/sections/DailyReportStatusSection.tsx
"use client";

import type { Dispatch, SetStateAction } from "react";
import type { NewDailyReportPayload } from "@/app/(app)/daily-reports/actions";
import DailyReportPhotosUploader from "@/components/daily-reports/DailyReportPhotosUploader";

type Props = {
  formState: NewDailyReportPayload;
  setFormState: Dispatch<SetStateAction<NewDailyReportPayload>>;
  reportId?: string | null; // opcjonalnie (dla edycji istniejącego)
  draftKey: string;         // zawsze (dla nowego)
};

export default function DailyReportStatusSection({ formState, setFormState, reportId = null, draftKey }: Props) {
  const photosCount = Array.isArray(formState.images) ? formState.images.length : 0;

  return (
    <section className="space-y-6">
      {/* STATUS ZADANIA */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Status zadania i dokumentacja</h2>

        <label className="inline-flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-border bg-background"
            checked={!!formState.isCompleted}
            onChange={(e) =>
              setFormState((prev) => ({
                ...prev,
                isCompleted: e.target.checked,
              }))
            }
          />
          <span>Zadanie jest zakończone</span>
        </label>
      </div>

      {/* ZDJĘCIA */}
      {formState.isCompleted && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Zdjęcia z wykonania</h3>
              <p className="text-xs text-muted-foreground">Maksymalnie 3 zdjęcia do tego raportu.</p>
            </div>
            <div className="text-[11px] text-muted-foreground">
              Dodane do raportu: <strong>{photosCount}</strong> / 3
            </div>
          </div>

          <DailyReportPhotosUploader
            reportId={reportId}
            draftKey={draftKey}
            value={formState.images}
            onChange={(paths) =>
              setFormState((prev) => ({
                ...prev,
                images: Array.isArray(paths) ? paths.slice(0, 3) : [],
              }))
            }
          />
        </div>
      )}
    </section>
  );
}
