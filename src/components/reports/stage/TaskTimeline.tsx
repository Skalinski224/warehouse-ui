// src/components/reports/stage/TaskTimeline.tsx
"use client";

export type TaskTimelineItem = {
  id: string;
  note: string | null;
  createdAt: string;          // kiedy zapisano completion
  reportId: string | null;
  reportDate: string | null;
  crewId: string | null;
  memberId: string | null;
  memberName: string | null;
  photosCount?: number;       // ile zdjęć w tym completion
};

type TaskTimelineProps = {
  completions: TaskTimelineItem[];
};

export default function TaskTimeline({ completions }: TaskTimelineProps) {
  if (!completions.length) {
    return (
      <div className="text-sm text-foreground/60">
        Brak zarejestrowanych wykonań tego zadania.
      </div>
    );
  }

  return (
    <ol className="relative border-l border-border/60 pl-4 space-y-4">
      {completions.map((c) => {
        const dateLabel = c.reportDate
          ? new Date(c.reportDate).toLocaleDateString()
          : new Date(c.createdAt).toLocaleString();

        return (
          <li key={c.id} className="ml-1">
            <div className="absolute -left-[9px] mt-1 h-3 w-3 rounded-full bg-primary shadow" />
            <div className="bg-card/40 border border-border/60 rounded-lg px-3 py-2 text-sm space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-foreground/70">
                <span className="font-medium">{dateLabel}</span>
                {c.crewId && (
                  <>
                    <span className="opacity-40">•</span>
                    <span>Brygada: {c.crewId}</span>
                  </>
                )}
                {c.memberName && (
                  <>
                    <span className="opacity-40">•</span>
                    <span>Wykonał(a): {c.memberName}</span>
                  </>
                )}
                {c.photosCount && c.photosCount > 0 && (
                  <>
                    <span className="opacity-40">•</span>
                    <span>{c.photosCount} zdjęć</span>
                  </>
                )}
              </div>

              {c.note && (
                <p className="text-sm text-foreground/80 whitespace-pre-line">
                  {c.note}
                </p>
              )}

              {c.reportId && (
                <div className="text-xs text-foreground/60">
                  Powiązany raport dzienny: {c.reportId}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
