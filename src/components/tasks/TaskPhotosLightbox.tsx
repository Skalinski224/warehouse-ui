"use client";

import { useEffect, useState } from "react";
import { PERM, can, canAny } from "@/lib/permissions";
import { usePermissionSnapshot } from "@/lib/RoleContext";

export type TaskPhotoItem = {
  id: string;
  url: string; // signed URL do wyświetlenia
  path: string; // storage path do usuwania
};

type Props = {
  photos: TaskPhotoItem[];
  taskId: string;
  deleteAction?: (formData: FormData) => Promise<void> | void;
};

export default function TaskPhotosLightbox({
  photos,
  taskId,
  deleteAction,
}: Props) {
  const snapshot = usePermissionSnapshot();

  const canSeePhotos = can(snapshot, PERM.TASKS_UPLOAD_PHOTOS);
  const canDeletePhotos = canAny(snapshot, [
    PERM.TASKS_UPDATE_ALL,
    PERM.TASKS_UPDATE_OWN,
  ]);

  if (!canSeePhotos) {
    return <p className="text-xs text-foreground/60">Brak dostępu do zdjęć.</p>;
  }

  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const hasPhotos = Array.isArray(photos) && photos.length > 0;

  const close = () => setOpenIndex(null);

  const prev = () => {
    if (!hasPhotos) return;
    setOpenIndex((current) => {
      if (current === null) return 0;
      const len = photos.length;
      return (current - 1 + len) % len;
    });
  };

  const next = () => {
    if (!hasPhotos) return;
    setOpenIndex((current) => {
      if (current === null) return 0;
      const len = photos.length;
      return (current + 1) % len;
    });
  };

  useEffect(() => {
    if (!hasPhotos || openIndex === null) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPhotos, openIndex]);

  if (!hasPhotos) {
    return <p className="text-xs text-foreground/60">Brak zdjęć.</p>;
  }

  const safeIndex =
    openIndex !== null && openIndex >= 0 && openIndex < photos.length
      ? openIndex
      : null;

  const showDelete = !!deleteAction && canDeletePhotos;

  return (
    <>
      {/* MINIATURY */}
      <div className="flex flex-wrap gap-3">
        {photos.map((p, i) => (
          <div
            key={p.id}
            className="relative w-32 h-32 rounded-lg overflow-hidden border border-border/70 group"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.url}
              className="object-cover w-full h-full cursor-zoom-in"
              onClick={() => setOpenIndex(i)}
              alt=""
            />

            {/* Usuń zdjęcie – tylko jeśli deleteAction istnieje + user ma prawo edycji */}
            {showDelete && (
              <form action={deleteAction} className="absolute top-1 right-1">
                <input type="hidden" name="task_id" value={taskId} />

                {/* ✅ nazwy pól zgodne z actions.ts */}
                <input type="hidden" name="photo_id" value={p.id} />
                <input type="hidden" name="photo_path" value={p.path} />

                <button
                  type="submit"
                  className="rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Usuń zdjęcie"
                >
                  ×
                </button>
              </form>
            )}
          </div>
        ))}
      </div>

      {/* LIGHTBOX */}
      {safeIndex !== null && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
          <button
            className="absolute top-4 right-4 text-white text-2xl"
            onClick={close}
            aria-label="Zamknij"
            type="button"
          >
            ×
          </button>

          <button
            className="absolute left-4 text-white text-4xl"
            onClick={prev}
            aria-label="Poprzednie zdjęcie"
            type="button"
          >
            ‹
          </button>

          <button
            className="absolute right-4 text-white text-4xl"
            onClick={next}
            aria-label="Następne zdjęcie"
            type="button"
          >
            ›
          </button>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photos[safeIndex].url}
            className="max-h-[90vh] max-w-[90vw] rounded-lg shadow-xl"
            alt=""
          />
        </div>
      )}
    </>
  );
}
