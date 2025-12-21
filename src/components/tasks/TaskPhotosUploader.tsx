// src/components/tasks/TaskPhotosUploader.tsx
"use client";

import { useMemo, useState, useTransition, DragEvent, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { uploadTaskPhotos } from "@/app/(app)/tasks/actions";
import { PERM, can } from "@/lib/permissions";
import { usePermissionSnapshot } from "@/lib/RoleContext";

type Props = {
  taskId: string;
  existingCount: number; // ile zdjęć już ma zadanie (z bazy)
};

const MAX_TOTAL = 3;

function isImageFile(f: File) {
  return !!f && f.size > 0 && (f.type?.startsWith("image/") ?? false);
}

export default function TaskPhotosUploader({ taskId, existingCount }: Props) {
  const snapshot = usePermissionSnapshot();
  const router = useRouter();

  if (!can(snapshot, PERM.TASKS_UPLOAD_PHOTOS)) {
    return <div className="text-xs text-foreground/60">Brak dostępu do dodawania zdjęć.</div>;
  }

  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isPending, startTransition] = useTransition();

  const already = Math.max(0, existingCount || 0);

  const remainingSlots = useMemo(() => {
    const queued = pendingFiles.length;
    return Math.max(0, MAX_TOTAL - already - queued);
  }, [already, pendingFiles.length]);

  function addFiles(list: FileList | null) {
    if (!list) return;

    const incoming = Array.from(list).filter(isImageFile);
    if (incoming.length === 0) return;

    setPendingFiles((prev) => {
      const currentQueued = prev.length;
      const allowed = Math.max(0, MAX_TOTAL - already - currentQueued);
      if (allowed <= 0) return prev;

      const toAdd = incoming.slice(0, allowed);
      return [...prev, ...toAdd];
    });
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (isPending) return;
    addFiles(e.dataTransfer.files);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    addFiles(e.target.files);
    e.target.value = "";
  }

  function removeQueued(index: number) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function handleUpload() {
    if (pendingFiles.length === 0 || isPending) return;

    const formData = new FormData();
    formData.append("task_id", taskId);
    for (const file of pendingFiles) formData.append("photos", file);

    startTransition(async () => {
      try {
        await uploadTaskPhotos(formData);

        // ✅ kluczowy fix: odśwież SSR + signed URL + existingCount
        router.refresh();

        setPendingFiles([]);
      } catch (err) {
        console.error("TaskPhotosUploader upload error:", err);
      }
    });
  }

  const disabledDrop = isPending || (MAX_TOTAL - already) <= 0;

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-foreground/70">
        Zdjęcia (max {MAX_TOTAL} łącznie). Aktualnie: {already} w zadaniu, {pendingFiles.length} w kolejce.
      </p>

      <div
        onDrop={disabledDrop ? undefined : handleDrop}
        onDragOver={disabledDrop ? undefined : handleDragOver}
        className={[
          "w-full rounded-md border border-dashed border-border bg-background/60 px-3 py-3",
          "text-[11px] text-center text-foreground/70",
          disabledDrop ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:border-foreground/70",
        ].join(" ")}
        onClick={() => {
          if (disabledDrop) return;
          const el = document.getElementById(`task-photos-input-${taskId}`) as HTMLInputElement | null;
          el?.click();
        }}
      >
        Przeciągnij zdjęcia lub kliknij, aby wybrać.
        <div className="mt-1 text-[10px] text-foreground/50">
          {MAX_TOTAL - already <= 0
            ? `Osiągnięto limit ${MAX_TOTAL} zdjęć dla tego zadania.`
            : `Pozostało miejsc: ${Math.max(0, MAX_TOTAL - already)} • w tej kolejce możesz dodać jeszcze: ${remainingSlots}`}
        </div>

        <input
          id={`task-photos-input-${taskId}`}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={handleInputChange}
          disabled={disabledDrop}
        />
      </div>

      {pendingFiles.length > 0 && (
        <ul className="space-y-1">
          {pendingFiles.map((file, idx) => (
            <li
              key={`${file.name}-${idx}`}
              className="flex items-center justify-between gap-2 text-[11px] bg-background/60 border border-border rounded px-2 py-1"
            >
              <span className="truncate">{file.name}</span>
              <button
                type="button"
                onClick={() => removeQueued(idx)}
                className="text-[11px] text-foreground/70 hover:text-foreground"
              >
                usuń
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={handleUpload}
        disabled={pendingFiles.length === 0 || isPending}
        className="inline-flex items-center justify-center rounded-md bg-foreground text-background px-3 py-1.5 text-[11px] font-semibold disabled:opacity-60 disabled:cursor-not-allowed hover:bg-foreground/90 transition"
      >
        {isPending ? "Wysyłanie..." : "Wyślij zdjęcia"}
      </button>
    </div>
  );
}
