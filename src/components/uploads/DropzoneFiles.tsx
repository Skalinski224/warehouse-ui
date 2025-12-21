"use client";

import React from "react";

type Props = {
  label: string;
  hint?: string;
  accept?: string;
  maxFiles: number;
  files: File[];
  isDragging?: boolean;
  onPick: (files: FileList | null) => void;
  onDropFiles: (files: FileList) => void;
  onRemoveAt: (index: number) => void;
  onDragStateChange?: (dragging: boolean) => void;
};

export default function DropzoneFiles({
  label,
  hint,
  accept,
  maxFiles,
  files,
  onPick,
  onDropFiles,
  onRemoveAt,
  onDragStateChange,
}: Props) {
  const [dragging, setDragging] = React.useState(false);

  function setDrag(v: boolean) {
    setDragging(v);
    onDragStateChange?.(v);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDrag(false);
    if (e.dataTransfer?.files?.length) onDropFiles(e.dataTransfer.files);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDrag(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDrag(false);
  }

  return (
    <div className="space-y-3">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs opacity-70">
          {hint ?? `Max ${maxFiles} pliki.`}
        </div>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={[
          "relative w-full rounded-xl border border-dashed px-3 py-4 text-sm",
          dragging
            ? "border-foreground bg-background/40"
            : "border-border bg-background/20 hover:bg-background/30",
        ].join(" ")}
      >
        <input
          type="file"
          multiple
          accept={accept}
          className="absolute inset-0 opacity-0 cursor-pointer"
          onChange={(e) => onPick(e.target.files)}
        />

        <div className="flex flex-col items-center justify-center gap-1 pointer-events-none">
          <span className="opacity-90">Przeciągnij tutaj lub kliknij, aby wybrać.</span>
          <span className="text-xs opacity-60">PDF, obrazy, Excel…</span>
        </div>
      </div>

      {files.length === 0 ? (
        <div className="text-xs opacity-70">Brak wybranych plików.</div>
      ) : (
        <ul className="space-y-2">
          {files.map((f, idx) => (
            <li
              key={`${f.name}-${idx}`}
              className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background/30 px-3 py-2"
            >
              <div className="min-w-0">
                <div className="text-sm truncate">{f.name}</div>
                <div className="text-[11px] opacity-70">{(f.size / 1024).toFixed(0)} KB</div>
              </div>

              <button
                type="button"
                onClick={() => onRemoveAt(idx)}
                className="text-sm px-3 py-1.5 rounded-lg border border-border/80 bg-background/30 hover:bg-background/50 transition"
              >
                Usuń
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
