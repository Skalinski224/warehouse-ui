// src/components/object/TaskForm.tsx
"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { createTask } from "@/app/(app)/object/actions";

type CrewOption = { id: string; name: string };
type MemberOption = { id: string; full_name: string };

type Props = {
  placeId: string;
  crewOptions?: CrewOption[];
  memberOptions?: MemberOption[];
  triggerLabel?: string;
};

const MAX_FILES = 3;

export default function TaskForm({
  placeId,
  crewOptions = [],
  memberOptions = [],
  triggerLabel = "+ Dodaj zadanie",
}: Props) {
  const [open, setOpen] = useState(false);
  const [assignMode, setAssignMode] = useState<"crew" | "member">("crew");

  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const titleRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const remaining = MAX_FILES - files.length;

  const hasCrewOptions = crewOptions.length > 0;
  const hasMemberOptions = memberOptions.length > 0;

  const canUseMemberMode = hasMemberOptions;
  const canUseCrewMode = hasCrewOptions;

  useEffect(() => {
    if (!open) return;
    setErr(null);
    // domyślnie: jeśli nie ma brygad, a są osoby -> member
    if (!canUseCrewMode && canUseMemberMode) setAssignMode("member");
    if (canUseCrewMode) setAssignMode("crew");

    const t = setTimeout(() => titleRef.current?.focus(), 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, submitting]);

  function syncInputFiles(nextFiles: File[]) {
    const input = fileInputRef.current;
    if (!input) return;
    const dt = new DataTransfer();
    nextFiles.forEach((f) => dt.items.add(f));
    input.files = dt.files;
  }

  function clearAll() {
    setFiles([]);
    setErr(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function close() {
    if (submitting) return;
    setOpen(false);
    clearAll();
  }

  function addFiles(list: FileList | null) {
    if (!list) return;

    const incoming = Array.from(list).filter((f) => {
      if (!f || f.size <= 0) return false;
      // tylko obrazy
      return f.type?.startsWith("image/");
    });

    if (incoming.length === 0) return;

    setFiles((prev) => {
      const merged = [...prev, ...incoming].slice(0, MAX_FILES);
      syncInputFiles(merged);
      return merged;
    });
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    addFiles(e.target.files);
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

  const fileHint = useMemo(() => {
    if (files.length === 0) return "Brak wybranych plików.";
    return `${files.length}/${MAX_FILES} plików`;
  }, [files.length]);

  async function onSubmit(formData: FormData) {
    setSubmitting(true);
    setErr(null);

    try {
      // twardo utrzymujemy tylko jedno przypisanie
      if (assignMode === "crew") {
        formData.delete("assigned_member_id");
      } else {
        formData.delete("assigned_crew_id");
      }

      await createTask(formData);

      setOpen(false);
      clearAll();
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || "Nie udało się dodać zadania.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center rounded-xl border border-border/70 bg-card/60 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-card/80 transition"
      >
        {triggerLabel}
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="w-full max-w-2xl rounded-2xl border border-border/70 bg-card/90 shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-foreground">Nowe zadanie</div>
            <div className="text-xs text-muted-foreground">
              Dodaj zadanie w tym miejscu i opcjonalnie przypisz brygadę lub osobę.
            </div>
          </div>

          <button
            type="button"
            onClick={close}
            className="rounded-xl border border-border/70 bg-background/40 px-3 py-2 text-xs hover:bg-background/60 disabled:opacity-60"
            disabled={submitting}
          >
            Zamknij
          </button>
        </div>

        <form action={onSubmit} className="px-5 py-4 space-y-4">
          <input type="hidden" name="place_id" value={placeId} />

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 md:col-span-2">
              <div className="text-[11px] text-muted-foreground">Tytuł zadania *</div>
              <input
                ref={titleRef}
                name="title"
                required
                placeholder="Np. Montaż przycisku EMERGENCY"
                className="w-full rounded-xl border border-border/70 bg-background/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/15"
                disabled={submitting}
              />
            </label>

            <label className="space-y-1 md:col-span-2">
              <div className="text-[11px] text-muted-foreground">Opis (opcjonalnie)</div>
              <textarea
                name="description"
                rows={3}
                placeholder="Szczegóły wykonania, wysokość, uwagi techniczne…"
                className="w-full resize-none rounded-xl border border-border/70 bg-background/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/15"
                disabled={submitting}
              />
            </label>
          </div>

          {/* Assign */}
          {(canUseCrewMode || canUseMemberMode) ? (
            <div className="space-y-2">
              <div className="text-[11px] text-muted-foreground">Przypisanie</div>

              <div className="flex flex-wrap items-center gap-3 text-[11px]">
                <label className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-background/30 px-3 py-2">
                  <input
                    type="radio"
                    checked={assignMode === "crew"}
                    onChange={() => setAssignMode("crew")}
                    disabled={!canUseCrewMode || submitting}
                  />
                  Brygada
                </label>

                <label className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-background/30 px-3 py-2">
                  <input
                    type="radio"
                    checked={assignMode === "member"}
                    onChange={() => setAssignMode("member")}
                    disabled={!canUseMemberMode || submitting}
                  />
                  Osoba
                </label>
              </div>

              {assignMode === "crew" ? (
                <select
                  name="assigned_crew_id"
                  className="w-full rounded-xl border border-border/70 bg-background/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/15"
                  defaultValue=""
                  disabled={submitting || !canUseCrewMode}
                >
                  <option value="">— brak przypisania —</option>
                  {crewOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  name="assigned_member_id"
                  className="w-full rounded-xl border border-border/70 bg-background/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/15"
                  defaultValue=""
                  disabled={submitting || !canUseMemberMode}
                >
                  <option value="">— brak przypisania —</option>
                  {memberOptions.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : null}

          {/* Upload jak w dostawach */}
          <div className="rounded-2xl border border-border/70 bg-card/60 px-4 py-3">
            <div className="text-sm font-semibold text-foreground">Zdjęcia</div>
            <div className="text-xs text-muted-foreground">Max {MAX_FILES} pliki.</div>

            <input
              ref={fileInputRef}
              type="file"
              name="photos"
              multiple
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
              disabled={submitting}
            />

            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
              className="mt-3 cursor-pointer rounded-xl border border-dashed border-border/70 bg-background/30 px-4 py-6 text-center text-sm text-foreground/80 hover:bg-background/40 hover:border-foreground/30 transition"
            >
              Przeciągnij tutaj lub kliknij, aby wybrać.
              <div className="mt-1 text-xs text-muted-foreground">
                JPG/PNG/WEBP • Pozostało: {remaining}
              </div>
            </div>

            <div className="mt-2 text-[11px] text-muted-foreground">{fileHint}</div>

            {files.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {files.map((f, i) => (
                  <li
                    key={`${f.name}-${i}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/30 px-3 py-2 text-xs"
                  >
                    <span className="min-w-0 truncate text-foreground/90">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(i)}
                      className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-[11px] text-rose-200 hover:bg-rose-500/15"
                      disabled={submitting}
                    >
                      Usuń
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {err ? (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              {err}
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={close}
              className="rounded-xl border border-border/70 bg-background/40 px-3 py-2 text-xs hover:bg-background/60 disabled:opacity-60"
              disabled={submitting}
            >
              Anuluj
            </button>

            <button
              type="submit"
              className="rounded-xl border border-border/70 bg-foreground/15 px-3 py-2 text-xs font-semibold hover:bg-foreground/20 disabled:opacity-60"
              disabled={submitting}
            >
              {submitting ? "Zapisuję…" : "Zapisz"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
