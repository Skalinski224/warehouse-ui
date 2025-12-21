"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
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

function isImageFile(f: File) {
  return !!f && f.size > 0 && (f.type?.startsWith("image/") ?? false);
}

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export default function NewTaskForm({ places, crewOptions, memberOptions }: Props) {
  const [open, setOpen] = useState(false);

  const [assignMode, setAssignMode] = useState<AssignMode>("none");

  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // PLACE PICKER (search + live list)
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeOpen, setPlaceOpen] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string>("");
  const [activeIndex, setActiveIndex] = useState(0);

  const placeInputRef = useRef<HTMLInputElement | null>(null);
  const placeListRef = useRef<HTMLDivElement | null>(null);

  const selectedPlace = useMemo(
    () => places.find((p) => p.id === selectedPlaceId) ?? null,
    [places, selectedPlaceId]
  );

  const filteredPlaces = useMemo(() => {
    const q = placeQuery.trim().toLowerCase();
    if (!q) return places.slice(0, 50);
    // proste, szybkie, live
    const out = places
      .filter((p) => (p.name ?? "").toLowerCase().includes(q))
      .slice(0, 50);
    return out;
  }, [places, placeQuery]);

  useEffect(() => {
    // jeśli user wybierze miejsce, pokazujemy nazwę w input
    if (selectedPlace && placeOpen === false) {
      setPlaceQuery(selectedPlace.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlaceId]);

  function openModal() {
    setErr(null);
    setOpen(true);
    // focus place input po otwarciu
    setTimeout(() => {
      placeInputRef.current?.focus();
      setPlaceOpen(true);
    }, 0);
  }

  function syncInputFiles(nextFiles: File[]) {
    const input = fileInputRef.current;
    if (!input) return;

    const dt = new DataTransfer();
    nextFiles.forEach((f) => dt.items.add(f));
    input.files = dt.files;
  }

  function addFiles(list: FileList | null) {
    if (!list) return;

    const incoming = Array.from(list).filter(isImageFile);
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

  const remaining = MAX_FILES - files.length;

  function resetAndClose() {
    setOpen(false);
    setErr(null);
    setSubmitting(false);

    setAssignMode("none");

    setFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";

    // place
    setPlaceOpen(false);
    setPlaceQuery("");
    setSelectedPlaceId("");
    setActiveIndex(0);
  }

  // zamknięcie ESC
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if ((e as any).key === "Escape") {
        if (submitting) return;
        resetAndClose();
      }
    }
    window.addEventListener("keydown", onKey as any);
    return () => window.removeEventListener("keydown", onKey as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, submitting]);

  function pickPlace(p: PlaceOption) {
    setSelectedPlaceId(p.id);
    setPlaceQuery(p.name);
    setPlaceOpen(false);
    setActiveIndex(0);
  }

  function onPlaceKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!placeOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") setPlaceOpen(true);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(0, filteredPlaces.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const p = filteredPlaces[activeIndex];
      if (p) pickPlace(p);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setPlaceOpen(false);
    }
  }

  // klik poza listą
  useEffect(() => {
    if (!open) return;

    function onDocMouseDown(ev: MouseEvent) {
      const target = ev.target as Node | null;
      if (!target) return;

      const inInput = placeInputRef.current?.contains(target) ?? false;
      const inList = placeListRef.current?.contains(target) ?? false;

      if (!inInput && !inList) {
        setPlaceOpen(false);
        // jeśli nic nie wybrano, nie nadpisuj query
        if (selectedPlace) setPlaceQuery(selectedPlace.name);
      }
    }

    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedPlaceId]);

  // launcher (jak na screenie – przycisk poza modalem)
  if (!open) {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={openModal}
          className="inline-flex items-center rounded-lg border border-border px-3 py-1.5 text-xs font-medium bg-card hover:bg-card/80 transition"
        >
          + Nowe zadanie
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={() => {
            if (submitting) return;
            resetAndClose();
          }}
        />

        {/* Modal */}
        <div className="relative z-10 w-[min(720px,92vw)] rounded-2xl border border-border/60 bg-card shadow-2xl">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border/60">
            <div>
              <div className="text-sm font-semibold">Nowe zadanie</div>
              <div className="text-[11px] text-foreground/60">
                Dodaj zadanie i opcjonalnie przypisz brygadę lub osobę.
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (submitting) return;
                resetAndClose();
              }}
              className="rounded-full border border-border px-3 py-1 text-[11px] bg-background/40 hover:bg-background/60 transition disabled:opacity-60"
              disabled={submitting}
            >
              Zamknij
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-4">
            <form
              encType="multipart/form-data"
              action={async (formData) => {
                setSubmitting(true);
                setErr(null);

                try {
                  // miejsce wymagane – walidujemy zanim poleci server action
                  if (!selectedPlaceId) {
                    throw new Error("Wybierz miejsce.");
                  }

                  // podpinamy place_id z wyszukiwarki
                  formData.set("place_id", selectedPlaceId);

                  // ✅ twardo: gwarantujemy, że do server action idą realne File
                  formData.delete("photos");
                  files.filter(isImageFile).forEach((f) => formData.append("photos", f));

                  // ✅ twardo: tylko jedno przypisanie
                  if (assignMode === "crew") {
                    formData.delete("assigned_member_id");
                  } else if (assignMode === "member") {
                    formData.delete("assigned_crew_id");
                  } else {
                    formData.delete("assigned_member_id");
                    formData.delete("assigned_crew_id");
                  }

                  await createTaskGlobal(formData);
                  resetAndClose();
                } catch (e: any) {
                  console.error(e);
                  setErr(e?.message || "Nie udało się dodać zadania.");
                  setSubmitting(false);
                }
              }}
              className="space-y-4"
            >
              {/* Tytuł */}
              <div className="space-y-1">
                <label className="block text-[11px] font-medium text-foreground/70">
                  Tytuł zadania *
                </label>
                <input
                  name="title"
                  required
                  placeholder="Np. Montaż przycisku EMERGENCY"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-foreground/40"
                  disabled={submitting}
                />
              </div>

              {/* Opis */}
              <div className="space-y-1">
                <label className="block text-[11px] font-medium text-foreground/70">
                  Opis (opcjonalnie)
                </label>
                <textarea
                  name="description"
                  rows={3}
                  placeholder="Szczegóły wykonania, wysokość, uwagi techniczne..."
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-foreground/40 resize-none"
                  disabled={submitting}
                />
              </div>

              {/* Przypisanie (jak na screenie) */}
              <div className="space-y-2">
                <div className="text-[11px] font-medium text-foreground/70">Przypisanie</div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAssignMode("crew")}
                    disabled={submitting}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] transition",
                      assignMode === "crew"
                        ? "border-foreground/40 bg-foreground/10 text-foreground"
                        : "border-border bg-background/40 text-foreground/70 hover:bg-background/60"
                    )}
                  >
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full border",
                        assignMode === "crew"
                          ? "bg-emerald-400/70 border-emerald-400/60"
                          : "bg-transparent border-border"
                      )}
                    />
                    Brygada
                  </button>

                  <button
                    type="button"
                    onClick={() => setAssignMode("member")}
                    disabled={submitting}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] transition",
                      assignMode === "member"
                        ? "border-foreground/40 bg-foreground/10 text-foreground"
                        : "border-border bg-background/40 text-foreground/70 hover:bg-background/60"
                    )}
                  >
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full border",
                        assignMode === "member"
                          ? "bg-emerald-400/70 border-emerald-400/60"
                          : "bg-transparent border-border"
                      )}
                    />
                    Osoba
                  </button>

                  <button
                    type="button"
                    onClick={() => setAssignMode("none")}
                    disabled={submitting}
                    className={cn(
                      "ml-auto rounded-full border px-3 py-1 text-[11px] transition",
                      assignMode === "none"
                        ? "border-foreground/40 bg-foreground/10 text-foreground"
                        : "border-border bg-background/40 text-foreground/70 hover:bg-background/60"
                    )}
                  >
                    — brak —
                  </button>
                </div>

                {/* Select (jedno pole, zależnie od trybu) */}
                {assignMode === "crew" && (
                  <select
                    name="assigned_crew_id"
                    defaultValue=""
                    disabled={submitting}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-foreground/40"
                  >
                    <option value="">— wybierz brygadę —</option>
                    {crewOptions.map((crew) => (
                      <option key={crew.id} value={crew.id}>
                        {crew.name}
                      </option>
                    ))}
                  </select>
                )}

                {assignMode === "member" && (
                  <select
                    name="assigned_member_id"
                    defaultValue=""
                    disabled={submitting}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-foreground/40"
                  >
                    <option value="">— wybierz osobę —</option>
                    {memberOptions.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                )}

                {assignMode === "none" && (
                  <div className="w-full rounded-xl border border-border bg-background/30 px-3 py-2 text-xs text-foreground/60">
                    — brak przypisania —
                  </div>
                )}
              </div>

              {/* Miejsce (WYSZUKIWARKA + LIVE LISTA) */}
              <div className="space-y-2">
                <div className="text-[11px] font-medium text-foreground/70">Miejsce *</div>

                <div className="relative">
                  <input
                    ref={placeInputRef}
                    value={placeQuery}
                    onChange={(e) => {
                      setPlaceQuery(e.target.value);
                      setPlaceOpen(true);
                      setActiveIndex(0);
                      // jeśli user zaczyna pisać “na czysto”, nie traktuj starego wyboru jako aktywny
                      if (selectedPlaceId && e.target.value !== selectedPlace?.name) {
                        setSelectedPlaceId("");
                      }
                    }}
                    onFocus={() => {
                      setPlaceOpen(true);
                      setActiveIndex(0);
                    }}
                    onKeyDown={onPlaceKeyDown}
                    placeholder="Szukaj miejsca..."
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-foreground/40"
                    disabled={submitting}
                  />

                  {placeOpen && (
                    <div
                      ref={placeListRef}
                      className="absolute z-20 mt-2 w-full rounded-xl border border-border bg-card shadow-xl overflow-hidden"
                    >
                      <div className="max-h-56 overflow-auto">
                        {filteredPlaces.length === 0 ? (
                          <div className="px-3 py-2 text-xs text-foreground/60">
                            Brak wyników.
                          </div>
                        ) : (
                          filteredPlaces.map((p, idx) => {
                            const active = idx === activeIndex;
                            const chosen = p.id === selectedPlaceId;

                            return (
                              <button
                                key={p.id}
                                type="button"
                                onMouseEnter={() => setActiveIndex(idx)}
                                onClick={() => pickPlace(p)}
                                className={cn(
                                  "w-full text-left px-3 py-2 text-xs border-b border-border/60 last:border-b-0",
                                  active ? "bg-background/60" : "bg-transparent",
                                  "hover:bg-background/60"
                                )}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className={cn(chosen ? "text-foreground" : "text-foreground/80")}>
                                    {p.name}
                                  </span>
                                  {chosen && (
                                    <span className="text-[10px] text-emerald-300/80">wybrane</span>
                                  )}
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>

                      <div className="px-3 py-2 text-[10px] text-foreground/50 border-t border-border/60">
                        {filteredPlaces.length > 0
                          ? `Pokazuję ${filteredPlaces.length} (max 50). Enter wybiera.`
                          : "Wpisz inną frazę."}
                      </div>
                    </div>
                  )}
                </div>

                {/* Hidden input wymagane przez server action */}
                <input type="hidden" name="place_id" value={selectedPlaceId} />

                {!selectedPlaceId ? (
                  <div className="text-[10px] text-foreground/50">
                    Wybierz pozycję z listy (żeby uniknąć literówek).
                  </div>
                ) : (
                  <div className="text-[10px] text-foreground/50">
                    Wybrane: <span className="text-foreground/70">{selectedPlace?.name}</span>
                  </div>
                )}
              </div>

              {/* Zdjęcia (ładny uploader jak na screenie) */}
              <div className="rounded-xl border border-border/60 bg-background/20 p-4 space-y-2">
                <div className="text-xs font-semibold">Zdjęcia</div>
                <div className="text-[11px] text-foreground/60">Max {MAX_FILES} pliki.</div>

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
                  onDrop={submitting ? undefined : handleDrop}
                  onDragOver={submitting ? undefined : handleDragOver}
                  onClick={() => (submitting ? null : fileInputRef.current?.click())}
                  className={cn(
                    "w-full rounded-xl border border-dashed border-border/70 bg-background/30 px-4 py-5",
                    "text-[11px] text-center text-foreground/70",
                    "hover:border-foreground/60 transition",
                    submitting ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
                  )}
                >
                  <div>Przeciągnij tutaj lub kliknij, aby wybrać.</div>
                  <div className="mt-1 text-[10px] text-foreground/50">
                    JPG/PNG/WEBP • Pozostało: {Math.max(0, remaining)}
                  </div>
                </div>

                <div className="text-[10px] text-foreground/50">
                  {files.length === 0 ? "Brak wybranych plików." : null}
                </div>

                {files.length > 0 && (
                  <ul className="space-y-1 pt-1">
                    {files.map((file, idx) => (
                      <li
                        key={`${file.name}-${idx}`}
                        className="flex items-center justify-between gap-2 text-[11px] bg-background/30 border border-border/60 rounded-lg px-3 py-2"
                      >
                        <span className="truncate text-foreground/80">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(idx)}
                          className="text-[11px] text-foreground/70 hover:text-foreground disabled:opacity-60"
                          disabled={submitting}
                        >
                          usuń
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Error */}
              {err ? (
                <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-[11px] text-rose-200">
                  {err}
                </div>
              ) : null}

              {/* Footer (Anuluj / Zapisz jak na screenie) */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (submitting) return;
                    resetAndClose();
                  }}
                  className="rounded-full border border-border px-4 py-2 text-[11px] bg-background/30 hover:bg-background/50 transition disabled:opacity-60"
                  disabled={submitting}
                >
                  Anuluj
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-full bg-foreground text-background px-5 py-2 text-[11px] font-semibold hover:bg-foreground/90 transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting ? "Zapisuję..." : "Zapisz"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
