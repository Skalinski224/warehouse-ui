// src/components/tasks/TaskPhotosUploader.tsx
"use client";

import { useState, useTransition, DragEvent, ChangeEvent } from "react";
import { uploadTaskPhotos } from "@/app/(app)/tasks/actions";

type Props = {
  taskId: string;
  existingCount: number; // ile zdjęć już ma zadanie (z bazy)
};

export default function TaskPhotosUploader({ taskId, existingCount }: Props) {
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isPending, startTransition] = useTransition();

  const maxTotal = 3;
  const already = existingCount;
  const queued = pendingFiles.length;
  const remainingSlots = Math.max(0, maxTotal - already - queued);

  function addFiles(files: FileList | null) {
    if (!files) return;

    const incoming = Array.from(files).filter((f) => f && f.size > 0);
    if (incoming.length === 0) return;

    setPendingFiles((prev) => {
      const currentQueued = prev.length;
      const allowed =
        maxTotal - already - currentQueued > 0
          ? maxTotal - already - currentQueued
          : 0;

      if (allowed <= 0) return prev;

      const toAdd = incoming.slice(0, allowed);
      return [...prev, ...toAdd];
    });
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    addFiles(e.target.files);
    // reset, żeby można było wybrać ten sam plik ponownie
    e.target.value = "";
  }

  function removeQueued(index: number) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function handleUpload() {
    if (pendingFiles.length === 0) return;

    const formData = new FormData();
    formData.append("task_id", taskId);
    for (const file of pendingFiles) {
      formData.append("photos", file);
    }

    startTransition(async () => {
      try {
        await uploadTaskPhotos(formData);
        setPendingFiles([]);
      } catch (err) {
        console.error("TaskPhotosUploader upload error:", err);
      }
    });
  }

  const disabled = isPending || remainingSlots <= 0;

  return (
    <div className="space-y-2 text-xs">
      <p className="text-[11px] text-foreground/70">
        Dodaj zdjęcia (max {maxTotal} łącznie). Aktualnie: {already} w zadaniu,{" "}
        {queued} w kolejce.
      </p>

      {/* Dropzone + input */}
      <div
        className={`border border-dashed rounded-md px-3 py-4 text-center cursor-pointer 
          ${disabled ? "border-border/60 text-foreground/40" : "border-border/90 text-foreground/80"}`}
        onDrop={disabled ? undefined : handleDrop}
        onDragOver={disabled ? undefined : handleDragOver}
      >
        <label className="inline-flex flex-col items-center gap-1 cursor-pointer">
          <span className="text-[11px]">
            Przeciągnij tutaj pliki lub kliknij, aby wybrać z dysku
          </span>
          <input
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={handleInputChange}
            disabled={disabled}
          />
        </label>
        {remainingSlots <= 0 && (
          <p className="mt-1 text-[10px] text-red-400/80">
            Osiągnięto limit {maxTotal} zdjęć dla tego zadania.
          </p>
        )}
      </div>

      {/* Lista plików w kolejce */}
      {pendingFiles.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] text-foreground/70">Do wysłania:</p>
          <ul className="space-y-0.5">
            {pendingFiles.map((file, idx) => (
              <li
                key={idx}
                className="flex items-center justify-between rounded border border-border/60 px-2 py-1"
              >
                <span className="truncate max-w-[220px]">{file.name}</span>
                <button
                  type="button"
                  onClick={() => removeQueued(idx)}
                  className="ml-2 text-[11px] text-foreground/70 hover:text-foreground"
                >
                  usuń
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={handleUpload}
        disabled={pendingFiles.length === 0 || isPending}
        className="mt-1 inline-flex items-center justify-center rounded bg-foreground text-background px-3 py-1.5 text-[11px] font-semibold disabled:opacity-60 disabled:cursor-not-allowed hover:bg-foreground/90"
      >
        {isPending ? "Wysyłanie..." : "Wyślij zdjęcia"}
      </button>
    </div>
  );
}
