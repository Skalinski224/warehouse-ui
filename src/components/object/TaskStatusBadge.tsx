// src/components/object/TaskStatusBadge.tsx
"use client";

export type TaskStatus = "todo" | "in_progress" | "done";

type Props = {
  status: TaskStatus;
};

const LABELS: Record<TaskStatus, string> = {
  todo: "Do zrobienia",
  in_progress: "W trakcie",
  done: "Zrobione",
};

export default function TaskStatusBadge({ status }: Props) {
  let colorClasses = "";

  switch (status) {
    case "todo":
      colorClasses =
        "bg-amber-500/10 text-amber-400 border-amber-500/40";
      break;
    case "in_progress":
      colorClasses =
        "bg-sky-500/10 text-sky-400 border-sky-500/40";
      break;
    case "done":
      colorClasses =
        "bg-emerald-500/10 text-emerald-400 border-emerald-500/40";
      break;
    default:
      colorClasses =
        "bg-foreground/5 text-foreground/70 border-border/60";
  }

  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide",
        "shadow-sm",
        colorClasses,
      ].join(" ")}
    >
      {LABELS[status] ?? status}
    </span>
  );
}
