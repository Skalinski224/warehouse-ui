// src/components/object/PlaceChildrenList.tsx
"use client";

import Link from "next/link";

export type ChildPlace = {
  id: string;
  name: string;
  description: string | null;
};

type Props = {
  places: ChildPlace[];
};

export default function PlaceChildrenList({ places }: Props) {
  if (!places || places.length === 0) {
    return (
      <div className="text-xs text-foreground/60 border border-dashed border-border/60 rounded-lg px-3 py-3">
        Brak pod-miejsc w tym miejscu. Możesz dodać pierwsze, żeby
        uszczegółowić strukturę obiektu (np. „Ściana północna”, „Sufit – trasa
        kablowa”).
      </div>
    );
  }

  return (
    <ul className="space-y-1">
      {places.map((place) => (
        <li key={place.id}>
          <Link
            href={`/object/${place.id}`}
            className="group flex items-start justify-between gap-2 rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-sm hover:border-border hover:bg-card transition"
          >
            <div>
              <div className="font-medium group-hover:underline">
                {place.name}
              </div>
              {place.description && (
                <div className="text-xs text-foreground/70 mt-0.5">
                  {place.description}
                </div>
              )}
            </div>
            <span className="text-[11px] text-foreground/60">
              Otwórz &rarr;
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
