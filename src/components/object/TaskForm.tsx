// src/components/object/TaskForm.tsx
"use client";

import {
  useState,
  useRef,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { createTask } from "@/app/(app)/object/actions";

type CrewOption = {
  id: string;
  name: string;
};

type Props = {
  placeId: string;
  crewOptions?: CrewOption[]; // opcjonalnie, na ETAP 2 może być pusta lista
};

const MAX_FILES = 3;

export default function TaskForm({ placeId, crewOptions = [] }: Props) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // synchronizuje ukryty <input type="file"> z naszym stanem
  function syncInputFiles(nextFiles: File[]) {
    const input = fileInputRef.current;
    if (!input) return;

    const dt = new DataTransfer();
    nextFiles.forEach((f) => dt.items.add(f));
    input.files = dt.files;
  }

  function addFiles(list: FileList | null) {
    if (!list) return;

    const incoming = Array.from(list).filter((f) => f && f.size > 0);
    if (incoming.length === 0) return;

    setFiles((prev) => {
      const merged = [...prev, ...incoming].slice(0, MAX_FILES);
      syncInputFiles(merged);
      return merged;
    });
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    addFiles(e.target.files);
    // input.files i tak nadpisujemy w syncInputFiles
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    addFiles(e.dataTransfer.files);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleRemoveFile(index: number) {
    setFiles((prev) => {
      const next = prev.filter((_, i) => i !== index);
      syncInputFiles(next);
      return next;
    });
  }

  const remaining = MAX_FILES - files.length;

  if (!open) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center rounded-lg border border-border px-3 py-1.5 text-xs font-medium bg-card hover:bg-card/80 transition"
        >
          + Dodaj zadanie
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="border border-border rounded-xl bg-card/70 px-3 py-3 space-y-2 min-w-[320px]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-foreground/80">
            Nowe zadanie
          </span>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setFiles([]);
              if (fileInputRef.current) {
                fileInputRef.current.value = "";
              }
            }}
            className="text-[11px] text-foreground/60 hover:text-foreground"
          >
            Anuluj
          </button>
        </div>

        <form
          // Next sam zadba o multipart/form-data
          action={async (formData) => {
            try {
              await createTask(formData);
              // po udanym zapisie czyścimy stan i zamykamy panel
              setFiles([]);
              if (fileInputRef.current) {
                fileInputRef.current.value = "";
              }
              setOpen(false);
            } catch (e) {
              console.error(e);
            }
          }}
          className="space-y-2"
        >
          <input type="hidden" name="place_id" value={placeId} />

          {/* Tytuł */}
          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-foreground/70">
              Tytuł zadania *
            </label>
            <input
              name="title"
              required
              placeholder="Np. Montaż przycisku EMERGENCY"
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-foreground/40"
            />
          </div>

          {/* Opis */}
          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-foreground/70">
              Opis (opcjonalnie)
            </label>
            <textarea
              name="description"
              placeholder="Szczegóły wykonania, wysokość montażu, przekroje kabli..."
              rows={3}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-foreground/40 resize-none"
            />
          </div>

          {/* Brygada */}
          {crewOptions.length > 0 && (
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-foreground/70">
                Przypisana brygada (opcjonalnie)
              </label>
              <select
                name="assigned_crew_id"
                defaultValue=""
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-foreground/40"
              >
                <option value="">— brak przypisania —</option>
                {crewOptions.map((crew) => (
                  <option key={crew.id} value={crew.id}>
                    {crew.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Zdjęcia przy tworzeniu */}
          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-foreground/70">
              Zdjęcia / załączniki (max 3)
            </label>

            {/* Ukryty input, który faktycznie trafia do formData */}
            <input
              ref={fileInputRef}
              type="file"
              name="photos"
              multiple
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            {/* Dropzone + klik do wyboru z dysku */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-md border border-dashed border-border bg-background/60 px-2 py-3 text-[11px] text-center text-foreground/70 cursor-pointer hover:border-foreground/70"
            >
              Przeciągnij tutaj pliki lub kliknij, aby wybrać z dysku.
              <div className="mt-1 text-[10px] text-foreground/50">
                Maks. {MAX_FILES} pliki.{" "}
                {remaining > 0
                  ? `Możesz dodać jeszcze ${remaining}.`
                  : "Osiągnięto limit."}
              </div>
            </div>

            {/* Lista wybranych plików */}
            {files.length > 0 && (
              <ul className="mt-1 space-y-1">
                {files.map((file, idx) => (
                  <li
                    key={idx}
                    className="flex items-center justify-between gap-2 text-[11px] bg-background/60 border border-border rounded px-2 py-1"
                  >
                    <span className="truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(idx)}
                      className="text-[11px] text-red-400 hover:text-red-300"
                    >
                      Usuń
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            type="submit"
            className="w-full inline-flex items-center justify-center rounded-md bg-foreground text-background text-xs font-semibold px-3 py-1.5 hover:bg-foreground/90 transition"
          >
            Zapisz zadanie
          </button>
        </form>
      </div>
    </div>
  );
}
