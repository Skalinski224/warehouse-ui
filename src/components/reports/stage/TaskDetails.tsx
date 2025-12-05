// src/components/reports/stage/TaskDetails.tsx
"use client";

import Link from "next/link";

type TaskStatus = "todo" | "in_progress" | "done";

export type TaskHeader = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  place: {
    id: string;
    name: string | null;
  } | null;
};

export type TaskAttachment = {
  id: string;
  url: string;
  createdAt: string;
};

type TaskDetailsProps = {
  task: TaskHeader;
  attachments: TaskAttachment[];
};

function statusLabel(status: TaskStatus): string {
  if (status === "todo") return "Do zrobienia";
  if (status === "in_progress") return "W trakcie";
  return "Zakończone";
}

export default function TaskDetails({ task, attachments }: TaskDetailsProps) {
  return (
    <section className="space-y-4">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{task.title}</h1>
          {task.description && (
            <p className="text-sm text-foreground/70">{task.description}</p>
          )}

          <div className="flex flex-wrap items-center gap-2 text-sm text-foreground/70">
            <span
              className={[
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs",
                task.status === "done"
                  ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                  : task.status === "in_progress"
                  ? "bg-amber-500/10 border-amber-500/40 text-amber-200"
                  : "bg-slate-500/10 border-slate-500/40 text-slate-200",
              ].join(" ")}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {statusLabel(task.status)}
            </span>

            {task.place && (
              <>
                <span className="opacity-60">•</span>
                <Link
                  href={`/object/${task.place.id}`}
                  className="underline-offset-2 hover:underline"
                >
                  {task.place.name || "Miejsce na obiekcie"}
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {attachments.length > 0 && (
        <div className="border border-border/70 rounded-xl p-3 bg-card/40">
          <h2 className="text-sm font-semibold mb-2">Załączniki referencyjne</h2>
          <ul className="space-y-1 text-sm">
            {attachments.map((a) => (
              <li key={a.id}>
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline-offset-2 hover:underline"
                >
                  Załącznik z {new Date(a.createdAt).toLocaleDateString()}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
