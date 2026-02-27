// src/app/(app)/materials/_components/AddMaterialModalClient.tsx
"use client";

import { useMemo, useRef, useState, type DragEvent } from "react";

type LocationOption = { id: string; label: string };

export default function AddMaterialModalClient({
  locations,
  defaultLocationId,
}: {
  locations: LocationOption[];
  defaultLocationId: string;
}) {
  // --- location picker (UX jak StartInventorySessionModal) ---
  const normalizedLocations = useMemo(() => {
    const map = new Map<string, LocationOption>();
    for (const l of locations ?? []) {
      const id = String(l?.id ?? "").trim();
      if (!id) continue;
      const label = String(l?.label ?? "").trim() || "—";
      if (!map.has(id)) map.set(id, { id, label });
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, "pl"));
  }, [locations]);

  const [locationOpen, setLocationOpen] = useState(false);

  const [selectedLocationId, setSelectedLocationId] = useState<string>(defaultLocationId || "");
  const [selectedLocationLabel, setSelectedLocationLabel] = useState<string>(() => {
    const found = normalizedLocations.find((x) => x.id === defaultLocationId);
    return found?.label ?? (defaultLocationId ? "—" : "");
  });

  const isNewLocation = selectedLocationId === "__NEW__";
  const [newLocationLabel, setNewLocationLabel] = useState("");

  function pickLocation(l: LocationOption) {
    setSelectedLocationId(l.id);
    setSelectedLocationLabel(l.label || "—");
    setLocationOpen(false);
  }

  function pickNew() {
    setSelectedLocationId("__NEW__");
    setSelectedLocationLabel("NOWA");
    setLocationOpen(false);
  }

  // --- upload box (zmienione zachowanie) ---
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [fileMeta, setFileMeta] = useState<{ size: number; type: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  function openFilePicker() {
    fileRef.current?.click();
  }

  function setFromFile(f: File | null) {
    if (!f) {
      setFileName("");
      setFileMeta(null);
      return;
    }
    setFileName(f.name);
    setFileMeta({ size: f.size, type: f.type || "" });
  }

  function onFilesSelected(files: FileList | null) {
    const f = files?.[0] ?? null;
    setFromFile(f);
  }

  function clearFile() {
    if (fileRef.current) {
      // reset input żeby można było wybrać ten sam plik ponownie
      fileRef.current.value = "";
    }
    setFromFile(null);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const files = e.dataTransfer?.files ?? null;
    if (!files || files.length === 0) return;

    // tylko 1 plik
    const f = files[0] ?? null;
    if (!f) return;

    // wstaw do inputa (żeby formData złapał plik)
    if (fileRef.current) fileRef.current.files = files;
    setFromFile(f);
  }

  function fmtSize(bytes: number) {
    if (!Number.isFinite(bytes) || bytes <= 0) return "—";
    const kb = bytes / 1024;
    if (kb < 1024) return `${Math.round(kb)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  }

  return (
    <>
      {/* Lokacja */}
      <div className="grid gap-2">
        <label className="text-sm">Lokacja</label>

        {/* ✅ to idzie do backendu */}
        <input
          type="hidden"
          name="inventory_location_id"
          value={isNewLocation ? "__NEW__" : selectedLocationId}
        />
        <input
          type="hidden"
          name="inventory_location_new_label"
          value={isNewLocation ? newLocationLabel : ""}
        />

        <div className="grid gap-2 relative">
          <button
            type="button"
            onClick={() => setLocationOpen((v) => !v)}
            className="h-10 border border-border bg-background rounded px-3 text-left flex items-center justify-between gap-2"
          >
            <span className={selectedLocationId ? "text-sm" : "text-sm opacity-70"}>
              {selectedLocationId ? selectedLocationLabel : "— wybierz lokację —"}
            </span>
            <span className="text-[11px] opacity-70">▼</span>
          </button>

          {locationOpen && (
            <div className="rounded-xl border border-border bg-background/20 p-2 space-y-1 max-h-[220px] overflow-auto">
              <button
                type="button"
                onClick={pickNew}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-background/40 transition flex items-center justify-between gap-2 border border-foreground/15 bg-foreground/5"
              >
                <span className="truncate font-medium">+ NOWA</span>
                {isNewLocation ? (
                  <span className="text-[11px] opacity-70 border border-border rounded px-2 py-1 bg-card">
                    wybrano
                  </span>
                ) : (
                  <span className="text-[11px] opacity-70">dodaj</span>
                )}
              </button>

              <div className="h-px bg-border/60 my-1" />

              {normalizedLocations.length === 0 ? (
                <div className="text-sm opacity-70 px-2 py-2">Brak lokacji na koncie.</div>
              ) : (
                normalizedLocations.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => pickLocation(l)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-background/40 transition flex items-center justify-between gap-2"
                  >
                    <span className="truncate">{l.label}</span>
                    {!isNewLocation && selectedLocationId === l.id ? (
                      <span className="text-[11px] opacity-70 border border-border rounded px-2 py-1 bg-card">
                        wybrano
                      </span>
                    ) : null}
                  </button>
                ))
              )}
            </div>
          )}

          {isNewLocation ? (
            <div className="grid gap-2 pt-1">
              <input
                value={newLocationLabel}
                onChange={(e) => setNewLocationLabel(e.target.value)}
                placeholder="Wpisz nazwę nowej lokacji"
                className="w-full border border-border bg-background rounded px-3 py-2"
                required
              />
              <p className="text-xs opacity-70">
                Utworzymy (lub dobierzemy istniejącą) lokację i przypiszemy do materiału.
              </p>
            </div>
          ) : (
            <p className="text-xs opacity-70">Wybierz lokację albo dodaj nową.</p>
          )}
        </div>
      </div>

      {/* Upload */}
      <div className="grid gap-2">
        <label className="text-sm">Miniaturka (opcjonalnie)</label>

        <input
          ref={fileRef}
          type="file"
          name="image"
          accept="image/*"
          className="hidden"
          onChange={(e) => onFilesSelected(e.target.files)}
        />

        {/* ✅ jeśli jest plik → pokazujemy “pozycję” i ukrywamy uploader */}
        {fileName ? (
          <div className="rounded-2xl border border-border bg-background/20 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{fileName}</div>
                <div className="mt-1 text-xs opacity-70">
                  {fileMeta?.type ? fileMeta.type : "obraz"} • {fileMeta ? fmtSize(fileMeta.size) : "—"}
                </div>
              </div>

              <button
                type="button"
                onClick={clearFile}
                className="px-3 py-2 rounded border border-border bg-card hover:bg-card/80 text-xs transition flex-shrink-0"
                title="Usuń plik"
              >
                Usuń
              </button>
            </div>
          </div>
        ) : (
          <div
            role="button"
            tabIndex={0}
            onClick={openFilePicker}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") openFilePicker();
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={[
              "rounded-2xl border border-border bg-background/20 p-4",
              "outline-none transition",
              dragOver ? "border-foreground/40 bg-background/30" : "",
            ].join(" ")}
          >
            <div className="rounded-xl border border-dashed border-border bg-background/10 px-4 py-6 text-center">
              <div className="text-sm">Przeciągnij tutaj lub kliknij, aby wybrać</div>
              <div className="mt-1 text-xs opacity-70">PNG, JPG, WEBP</div>
            </div>

            <div className="mt-2 text-xs opacity-70">Brak wybranego pliku.</div>
          </div>
        )}
      </div>
    </>
  );
}
