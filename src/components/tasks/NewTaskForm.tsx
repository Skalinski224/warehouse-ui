// src/components/tasks/NewTaskForm.tsx
"use client";

import {
  useState,
  useRef,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { createTaskGlobal } from "@/app/(app)/tasks/actions";

type PlaceOption = {
  id: string;
  name: string;
};

type CrewOption = {
  id: string;
  name: string;
};

type MemberOption = {
  id: string;
  label: string;
};

type Props = {
  places: PlaceOption[];
  crewOptions: CrewOption[];
  memberOptions: MemberOption[];
};

type AssignMode = "none" | "crew" | "member";

const MAX_FILES = 3;

export default function NewTaskForm({
  places,
  crewOptions,
  memberOptions,
}: Props) {
  const [assignMode, setAssignMode] = useState<AssignMode>("none");
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
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center rounded-lg border border-border px-3 py-1.5 text-xs font-medium bg-card hover:bg-card/80 transition"
        >
          + Nowe zadanie
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card/60 px-4 py-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground/80">
          Nowe zadanie
        </h2>

        <div className="flex items-center gap-2 text-[11px] text-foreground/60">
          <span>Przypisz do:</span>
          <button
            type="button"
            onClick={() => setAssignMode("none")}
            className={`px-2 py-0.5 rounded-full border text-[11px] ${
              assignMode === "none"
                ? "border-foreground/60 bg-foreground/10 text-foreground"
                : "border-border hover:border-foreground/40"
            }`}
          >
            nikogo
          </button>
          <button
            type="button"
            onClick={() => setAssignMode("crew")}
            className={`px-2 py-0.5 rounded-full border text-[11px] ${
              assignMode === "crew"
                ? "border-foreground/60 bg-foreground/10 text-foreground"
                : "border-border hover:border-foreground/40"
            }`}
          >
            brygady
          </button>
          <button
            type="button"
            onClick={() => setAssignMode("member")}
            className={`px-2 py-0.5 rounded-full border text-[11px] ${
              assignMode === "member"
                ? "border-foreground/60 bg-foreground/10 text-foreground"
                : "border-border hover:border-foreground/40"
            }`}
          >
            osoby
          </button>
        </div>

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
        action={async (formData) => {
          try {
            await createTaskGlobal(formData);
            setFiles([]);
            if (fileInputRef.current) {
              fileInputRef.current.value = "";
            }
            setOpen(false);
          } catch (e) {
            console.error(e);
          }
        }}
        className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end"
      >
        {/* Tytuł */}
        <div className="md:col-span-2 space-y-1">
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

        {/* Miejsce */}
        <div className="space-y-1">
          <label className="block text-[11px] font-medium text-foreground/70">
            Miejsce *
          </label>
          <select
            name="place_id"
            required
            defaultValue=""
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-foreground/40"
          >
            <option value="" disabled>
              — wybierz miejsce —
            </option>
            {places.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Opis */}
        <div className="md:col-span-4 space-y-1">
          <label className="block text-[11px] font-medium text-foreground/70">
            Opis (opcjonalnie)
          </label>
          <textarea
            name="description"
            rows={2}
            placeholder="Dodatkowe szczegóły, wymagania, wysokość montażu itd."
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-foreground/40 resize-none"
          />
        </div>

        {/* Brygada / osoba */}
        <div className="space-y-1">
          <label className="block text-[11px] font-medium text-foreground/70">
            Brygada
          </label>
          <select
            name="assigned_crew_id"
            defaultValue=""
            disabled={assignMode !== "crew"}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-foreground/40 disabled:opacity-50"
          >
            <option value="">— brak przypisania —</option>
            {crewOptions.map((crew) => (
              <option key={crew.id} value={crew.id}>
                {crew.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-[11px] font-medium text-foreground/70">
            Osoba
          </label>
          <select
            name="assigned_member_id"
            defaultValue=""
            disabled={assignMode !== "member"}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-foreground/40 disabled:opacity-50"
          >
            <option value="">— brak przypisania —</option>
            {memberOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* Zdjęcia przy tworzeniu */}
        <div className="md:col-span-4 space-y-1">
          <label className="block text-[11px] font-medium text-foreground/70">
            Zdjęcia / załączniki (max {MAX_FILES})
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

        <div className="md:col-span-2 flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-md bg-foreground text-background text-xs font-semibold px-3 py-1.5 hover:bg-foreground/90 transition"
          >
            Dodaj zadanie
          </button>
        </div>
      </form>
    </div>
  );
}
