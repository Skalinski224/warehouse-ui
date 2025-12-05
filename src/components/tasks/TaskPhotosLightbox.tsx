// src/components/tasks/TaskPhotosLightbox.tsx
"use client";

import { useEffect, useState } from "react";

type Props = {
  photos: string[];
  taskId: string;
  deleteAction: (formData: FormData) => Promise<void> | void;
};

export default function TaskPhotosLightbox({
  photos,
  taskId,
  deleteAction,
}: Props) {
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

  // klawisze: Esc, strzałki – HOOK ZAWSZE SIĘ WYWOUJE
  useEffect(() => {
    if (!hasPhotos || openIndex === null) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [hasPhotos, openIndex]);

  // ------------------ RENDER ------------------
  if (!hasPhotos) {
    return (
      <p className="text-xs text-foreground/60">
        Brak zdjęć.
      </p>
    );
  }

  const safeIndex =
    openIndex !== null && openIndex >= 0 && openIndex < photos.length
      ? openIndex
      : null;

  return (
    <>
      {/* MINIATURY */}
      <div className="flex flex-wrap gap-3">
        {photos.map((url, i) => (
          <div
            key={i}
            className="relative w-32 h-32 rounded-lg overflow-hidden border border-border/70 group"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              className="object-cover w-full h-full cursor-zoom-in"
              onClick={() => setOpenIndex(i)}
            />

            {/* Usuń zdjęcie – przycisk na miniaturze */}
            <form
              action={deleteAction}
              className="absolute top-1 right-1"
            >
              <input type="hidden" name="task_id" value={taskId} />
              <input type="hidden" name="photo_url" value={url} />
              <button
                type="submit"
                className="rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ×
              </button>
            </form>
          </div>
        ))}
      </div>

      {/* LIGHTBOX */}
      {safeIndex !== null && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
          {/* Zamknij */}
          <button
            className="absolute top-4 right-4 text-white text-2xl"
            onClick={close}
            aria-label="Zamknij"
          >
            ×
          </button>

          {/* Poprzednie */}
          <button
            className="absolute left-4 text-white text-4xl"
            onClick={prev}
            aria-label="Poprzednie zdjęcie"
          >
            ‹
          </button>

          {/* Następne */}
          <button
            className="absolute right-4 text-white text-4xl"
            onClick={next}
            aria-label="Następne zdjęcie"
          >
            ›
          </button>

          {/* Obraz */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photos[safeIndex]}
            className="max-h-[90vh] max-w-[90vw] rounded-lg shadow-xl"
          />
        </div>
      )}
    </>
  );
}
