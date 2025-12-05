// src/components/reports/stage/TaskPhotosGallery.tsx
"use client";

export type TaskPhoto = {
  id: string;
  url: string;
  createdAt: string;
  createdByName?: string | null;
};

type TaskPhotosGalleryProps = {
  photos: TaskPhoto[];
};

export default function TaskPhotosGallery({ photos }: TaskPhotosGalleryProps) {
  if (!photos.length) {
    return (
      <div className="text-sm text-foreground/60">
        Brak zdjęć z realizacji tego zadania.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {photos.map((p) => {
        const label = new Date(p.createdAt).toLocaleString();
        return (
          <figure
            key={p.id}
            className="group overflow-hidden rounded-lg border border-border/60 bg-card/60"
          >
            <a href={p.url} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt={label}
                className="w-full h-32 object-cover group-hover:scale-105 transition-transform"
              />
            </a>
            <figcaption className="px-2 py-1.5 text-[11px] text-foreground/70 space-y-0.5">
              <div>{label}</div>
              {p.createdByName && (
                <div className="opacity-80">Autor: {p.createdByName}</div>
              )}
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}
