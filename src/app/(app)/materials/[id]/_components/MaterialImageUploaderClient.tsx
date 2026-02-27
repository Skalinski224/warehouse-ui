// src/app/(app)/materials/[id]/_components/MaterialImageUploaderClient.tsx
"use client";

import { useMemo, useRef, useState } from "react";

function fmtBytes(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  const fixed = i === 0 ? String(Math.round(v)) : v.toFixed(v < 10 ? 1 : 0);
  return `${fixed} ${units[i]}`;
}

type Props = {
  materialId: string;
  action: (formData: FormData) => Promise<void>;
  disabled?: boolean;
};

export default function MaterialImageUploaderClient({ materialId, action, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const meta = useMemo(() => {
    if (!file) return null;
    return `${file.type || "application/octet-stream"} · ${fmtBytes(file.size)}`;
  }, [file]);

  function syncInputWithFile(f: File | null) {
    const el = inputRef.current;
    if (!el) return;

    if (!f) {
      el.value = "";
      return;
    }

    // Ustawiamy file w input (dla dropa) przez DataTransfer
    try {
      const dt = new DataTransfer();
      dt.items.add(f);
      el.files = dt.files;
    } catch {
      // jeśli przeglądarka nie pozwoli, to i tak kliknięcie inputa zadziała normalnie
    }
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
  }

  function onRemoveSelected() {
    setFile(null);
    syncInputWithFile(null);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (disabled) return;

    const f = e.dataTransfer.files?.[0] ?? null;
    if (!f) return;

    setFile(f);
    syncInputWithFile(f);
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    setDragOver(true);
  }

  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }

  return (
    <div className="space-y-2">
      <div className="text-[11px] text-foreground/60">
        Obsługiwane: <b>PNG / JPG / WEBP</b> • 1 plik
      </div>

      <form action={action} className="space-y-2">
        <input type="hidden" name="id" value={materialId} />

        <input
          ref={inputRef}
          type="file"
          name="image"
          accept="image/jpeg,image/png,image/webp"
          disabled={!!disabled}
          className="hidden"
          id={`material-image-input-${materialId}`}
          onChange={onChange}
        />

        {/* 1) Widok: dropzone (brak pliku) */}
        {!file ? (
          <label
            htmlFor={`material-image-input-${materialId}`}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            className={[
              "block w-full rounded-xl border border-dashed",
              "bg-background/30 px-4 py-5 text-center cursor-pointer transition",
              dragOver ? "border-foreground/80" : "border-border/70 hover:border-foreground/60",
              disabled ? "opacity-60 cursor-not-allowed" : "",
            ].join(" ")}
          >
            <div className="text-[11px] text-foreground/70">
              Przeciągnij tutaj lub kliknij, aby wybrać
            </div>
            <div className="mt-1 text-[10px] text-foreground/50">PNG, JPG, WEBP</div>
            <div className="mt-2 text-[10px] text-foreground/50">Brak wybranego pliku.</div>
          </label>
        ) : (
          /* 2) Widok: wybrany plik (pozycja jak na screenie) */
          <div className="rounded-xl border border-border bg-background/20 px-3 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{file.name}</div>
              <div className="text-[11px] text-foreground/60">{meta}</div>
            </div>

            <button
              type="button"
              onClick={onRemoveSelected}
              disabled={!!disabled}
              className="shrink-0 rounded-md border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-card/80 transition disabled:opacity-60"
            >
              Usuń
            </button>
          </div>
        )}

        <button
          disabled={!!disabled || !file}
          className={[
            "w-full rounded-full px-5 py-2 text-[11px] font-semibold transition",
            !file || disabled
              ? "bg-background/30 text-foreground/50 border border-border cursor-not-allowed"
              : "bg-foreground text-background hover:bg-foreground/90",
          ].join(" ")}
        >
          Zapisz zdjęcie
        </button>
      </form>

      <div className="text-[10px] text-foreground/50">
        Po zapisie miniatura odświeży się po przeładowaniu strony (SSR).
      </div>
    </div>
  );
}