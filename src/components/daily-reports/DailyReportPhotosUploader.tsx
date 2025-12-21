// src/components/daily-reports/DailyReportPhotosUploader.tsx
"use client";

import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type DragEvent,
  type ChangeEvent,
} from "react";
import { uploadDailyReportPhotos, deleteDailyReportPhoto } from "@/app/(app)/daily-reports/actions";
import { PERM, canAny, can } from "@/lib/permissions";
import { usePermissionSnapshot } from "@/lib/RoleContext";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type Props = {
  reportId?: string | null; // opcjonalnie (dla edycji istniejącego)
  draftKey: string; // zawsze jest (dla nowego)
  value: string[]; // PATHY
  onChange: (paths: string[]) => void;
};

function isImagePath(p: string) {
  const s = p.toLowerCase();
  return (
    s.endsWith(".png") ||
    s.endsWith(".jpg") ||
    s.endsWith(".jpeg") ||
    s.endsWith(".webp") ||
    s.endsWith(".gif")
  );
}

type PreviewMap = Record<string, string>; // path -> signedUrl

export default function DailyReportPhotosUploader({
  reportId = null,
  draftKey,
  value,
  onChange,
}: Props) {
  const snapshot = usePermissionSnapshot();

  const canEditDailyReport = canAny(snapshot, [
    PERM.DAILY_REPORTS_CREATE,
    PERM.DAILY_REPORTS_UPDATE_UNAPPROVED,
  ]);

  const canUpload = can(snapshot, PERM.DAILY_REPORTS_PHOTOS_UPLOAD);
  const canDelete = can(snapshot, PERM.DAILY_REPORTS_PHOTOS_DELETE);

  if (!canEditDailyReport || !canUpload) {
    return <div className="text-xs text-foreground/60">Brak dostępu do dodawania zdjęć.</div>;
  }

  const [isPending, startTransition] = useTransition();
  const [localError, setLocalError] = useState<string | null>(null);

  const maxTotal = 3;
  const already = value.length;
  const remainingSlots = Math.max(0, maxTotal - already);

  // ✅ PATH -> signedUrl (żeby miniatury nie robiły 404 na Next route)
  const [previewMap, setPreviewMap] = useState<PreviewMap>({});

  const hint = useMemo(() => {
    if (remainingSlots <= 0) return `Limit ${maxTotal} zdjęć osiągnięty. Usuń coś, aby dodać nowe.`;
    return "Przeciągnij tutaj lub kliknij, aby wybrać.";
  }, [remainingSlots]);

  // Generuj signed URL-e dla aktualnych pathów
  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const paths = (value ?? []).filter(Boolean).slice(0, maxTotal);
        if (paths.length === 0) {
          if (!cancelled) setPreviewMap({});
          return;
        }

        const sb = supabaseBrowser();
        const next: PreviewMap = {};

        for (const path of paths) {
          if (!isImagePath(path)) continue;

          const { data, error } = await sb.storage
            .from("report-images")
            .createSignedUrl(path, 60 * 60);

          if (!error && data?.signedUrl) {
            next[path] = data.signedUrl;
          } else {
            console.warn("[DailyReportPhotosUploader] createSignedUrl error:", { path, error });
          }
        }

        if (!cancelled) setPreviewMap(next);
      } catch (e) {
        console.warn("[DailyReportPhotosUploader] signed urls error:", e);
        if (!cancelled) setPreviewMap({});
      }
    }

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify((value ?? []).slice(0, maxTotal))]);

  function addFiles(files: FileList | null) {
    if (!files) return;
    setLocalError(null);

    const incoming = Array.from(files).filter((f) => f && f.size > 0);
    if (incoming.length === 0) return;

    const allowed = Math.max(0, maxTotal - value.length);
    if (allowed <= 0) return;

    const toUpload = incoming.slice(0, allowed);

    const fd = new FormData();
    if (reportId) fd.append("report_id", reportId);
    fd.append("draft_key", draftKey);

    for (const file of toUpload) fd.append("photos", file);

    startTransition(async () => {
      try {
        const res = await uploadDailyReportPhotos(fd);
        const uploaded = Array.isArray(res?.paths) ? res.paths : [];
        if (uploaded.length > 0) {
          const merged = [...value, ...uploaded].slice(0, maxTotal);
          onChange(merged);
        }
      } catch (err) {
        console.error("DailyReportPhotosUploader upload error:", err);
        setLocalError("Nie udało się wgrać zdjęć.");
      }
    });
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (isPending) return;
    addFiles(e.dataTransfer.files);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    if (isPending) return;
    addFiles(e.target.files);
    e.target.value = "";
  }

  function handleRemove(path: string) {
    if (!canDelete) return;

    startTransition(async () => {
      try {
        await deleteDailyReportPhoto(path);
        onChange(value.filter((p) => p !== path));
        setPreviewMap((prev) => {
          const next = { ...prev };
          delete next[path];
          return next;
        });
      } catch (err) {
        console.error("deleteDailyReportPhoto error:", err);
        setLocalError("Nie udało się usunąć zdjęcia.");
      }
    });
  }

  const disabled = isPending || remainingSlots <= 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-foreground/70">
          Maksymalnie {maxTotal} zdjęcia. Dodane: <strong>{already}</strong> / {maxTotal}
        </p>
        {isPending ? (
          <span className="text-[11px] text-muted-foreground">Wysyłanie…</span>
        ) : (
          <span className="text-[11px] text-muted-foreground">OK</span>
        )}
      </div>

      <div
        className={[
          "rounded-2xl border border-dashed px-3 py-4 text-center",
          "bg-background/20",
          disabled ? "border-border/60 text-foreground/40" : "border-border/90 text-foreground/80",
        ].join(" ")}
        onDrop={disabled ? undefined : handleDrop}
        onDragOver={disabled ? undefined : handleDragOver}
      >
        <label className="inline-flex flex-col items-center gap-1 cursor-pointer">
          <span className="text-sm font-medium">{hint}</span>
          <span className="text-[11px] text-muted-foreground">Obrazy (JPG/PNG/WEBP). Max 3.</span>
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
          <p className="mt-2 text-[11px] text-red-400/80">Osiągnięto limit {maxTotal} zdjęć.</p>
        )}
      </div>

      {localError && (
        <div className="text-[11px] text-red-300 border border-red-500/40 rounded-xl px-3 py-2 bg-red-500/10">
          {localError}
        </div>
      )}

      {value.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-3">
          {value.slice(0, maxTotal).map((path, idx) => {
            const signedUrl = previewMap[path];

            return (
              <div key={`${path}-${idx}`} className="rounded-2xl border border-border bg-background/30 p-2">
                {/* miniatura: jeśli to obraz -> signed url */}
                {isImagePath(path) && signedUrl ? (
                  <a href={signedUrl} target="_blank" rel="noreferrer" className="block">
                    <img
                      src={signedUrl}
                      alt="Zdjęcie raportu"
                      className="h-24 w-full rounded-xl object-cover"
                      loading="lazy"
                    />
                  </a>
                ) : (
                  <div className="h-24 w-full rounded-xl bg-foreground/5 flex items-center justify-center text-[11px] text-muted-foreground">
                    {isImagePath(path) ? "zdjęcie zapisane" : "plik"}
                  </div>
                )}

                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="truncate text-[11px] text-muted-foreground">{path}</div>

                  {canDelete ? (
                    <button
                      type="button"
                      onClick={() => handleRemove(path)}
                      className="shrink-0 text-[11px] text-foreground/70 hover:text-foreground"
                      disabled={isPending}
                    >
                      usuń
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
