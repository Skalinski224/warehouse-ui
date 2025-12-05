// src/components/object/PlaceBreadcrumb.tsx
"use client";

import Link from "next/link";

export type PlaceCrumb = {
  id: string;
  name: string;
};

type Props = {
  /**
   * Ścieżka miejsc od "najwyższego" do aktualnego.
   * Np.:
   * [
   *   { id: "uuid1", name: "Rozdzielnia A" },
   *   { id: "uuid2", name: "Ściana północna" }
   * ]
   */
  chain: PlaceCrumb[];
};

export default function PlaceBreadcrumb({ chain }: Props) {
  if (!chain || chain.length === 0) {
    // tylko root Obiekt
    return (
      <nav
        className="text-xs text-foreground/70 flex items-center gap-1"
        aria-label="Breadcrumb"
      >
        <span className="font-medium">Obiekt</span>
      </nav>
    );
  }

  const lastIndex = chain.length - 1;

  return (
    <nav
      className="text-xs text-foreground/70 flex flex-wrap items-center gap-1"
      aria-label="Breadcrumb"
    >
      {/* Root: Obiekt */}
      <Link
        href="/object"
        className="hover:underline hover:text-foreground transition"
      >
        Obiekt
      </Link>

      <span className="opacity-60">/</span>

      {chain.map((crumb, index) => {
        const isLast = index === lastIndex;

        if (isLast) {
          return (
            <span
              key={crumb.id}
              className="font-medium text-foreground truncate max-w-[200px]"
            >
              {crumb.name}
            </span>
          );
        }

        return (
          <span key={crumb.id} className="flex items-center gap-1">
            <Link
              href={`/object/${crumb.id}`}
              className="hover:underline hover:text-foreground transition truncate max-w-[180px]"
            >
              {crumb.name}
            </Link>
            <span className="opacity-60">/</span>
          </span>
        );
      })}
    </nav>
  );
}
