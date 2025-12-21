// src/app/(app)/object/_components/PlacesListClient.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import PlaceDeleteButton from "@/components/object/PlaceDeleteButton";
import type { PlaceRow } from "../page";

type Props = {
  places: PlaceRow[];
};

function norm(s: string) {
  return (s || "").toLowerCase().trim();
}

export default function PlacesListClient({ places }: Props) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const qn = norm(q);

  const filtered = React.useMemo(() => {
    if (!qn) return places;
    return places.filter((p) => {
      const hay = norm([p.name ?? "", p.description ?? ""].join(" "));
      return hay.includes(qn);
    });
  }, [places, qn]);

  return (
    <div className="space-y-3">
      {/* Live search */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-muted-foreground">
          Wyników:{" "}
          <span className="font-medium text-foreground">{filtered.length}</span>
        </div>

        <div className="w-full sm:max-w-[520px]">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Szukaj (nazwa, opis)…"
            className="w-full rounded-xl border border-border/70 bg-background/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/15"
          />
        </div>
      </div>

      {/* Lista */}
      <ul className="space-y-2">
        {filtered.map((place) => (
          <li key={place.id}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => router.push(`/object/${place.id}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push(`/object/${place.id}`);
                }
              }}
              className={[
                "group cursor-pointer rounded-2xl border border-border/70 bg-card/60 shadow-sm",
                "transition-all",
                // mocniejszy kontrast na hover
                "hover:bg-card/90 hover:border-border hover:shadow-md",
                // subtelna “poświata” żeby było czuć interakcję
                "hover:ring-1 hover:ring-foreground/10",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  {/* większa “majestatyczna” nazwa */}
                  <div className="truncate text-base font-semibold tracking-tight text-foreground sm:text-lg">
                    {place.name}
                  </div>

                  {place.description ? (
                    <div className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                      {place.description}
                    </div>
                  ) : (
                    <div className="mt-1 text-xs text-muted-foreground/70">
                      Brak opisu
                    </div>
                  )}
                </div>

                {/* delete ma nie otwierać */}
                <div
                  className="shrink-0"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <PlaceDeleteButton placeId={place.id} parentId={null} />
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
