// src/components/ReportPhotosLightbox.tsx
"use client";

import { useEffect, useState } from "react";
import { PERM, can } from "@/lib/permissions";
import { usePermissionSnapshot } from "@/lib/RoleContext";

type Props = {
  photos: string[];
};

export default function ReportPhotosLightbox({ photos }: Props) {
  const snapshot = usePermissionSnapshot();

  // Gate: dostęp do zdjęć (w kanonie używamy tego samego klucza co dla task photos)
  if (!can(snapshot, PERM.TASKS_UPLOAD_PHOTOS)) {
    return (
      <p className="text-sm text-muted-foreground">
        Brak dostępu do zdjęć.
      </p>
    );
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

  // klawisze: Esc + strzałki
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
    return <p className="text-sm text-muted-foreground">Brak zdjęć.</p>;
  }

  const safeIndex =
    openIndex !== null && openIndex >= 0 && openIndex < photos.length
      ? openIndex
      : null;

  return (
    <>
      {/* MINIATURY */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {photos.map((url, i) => (
          <button
            key={i}
            type="button"
            className="group relative block overflow-hidden rounded-lg border border-border/60 bg-background"
            onClick={() => setOpenIndex(i)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`Zdjęcie ${i + 1}`}
              className="h-32 w-full object-cover transition-transform duration-200 group-hover:scale-105 cursor-zoom-in"
            />
            <div className="pointer-events-none absolute inset-0 bg-black/0 group-hover:bg-black/10" />
          </button>
        ))}
      </div>

      {/* LIGHTBOX */}
      {safeIndex !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          {/* Zamknij */}
          <button
            type="button"
            className="absolute top-4 right-4 text-2xl text-white"
            onClick={close}
            aria-label="Zamknij"
          >
            ×
          </button>

          {/* Poprzednie */}
          <button
            type="button"
            className="absolute left-4 text-4xl text-white"
            onClick={prev}
            aria-label="Poprzednie zdjęcie"
          >
            ‹
          </button>

          {/* Następne */}
          <button
            type="button"
            className="absolute right-4 text-4xl text-white"
            onClick={next}
            aria-label="Następne zdjęcie"
          >
            ›
          </button>

          {/* Obraz */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photos[safeIndex]}
            alt={`Zdjęcie ${safeIndex + 1}`}
            className="max-h-[90vh] max-w-[90vw] rounded-lg shadow-xl"
          />
        </div>
      )}
    </>
  );
}
