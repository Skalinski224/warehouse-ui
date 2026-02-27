// src/app/(app)/materials/_components/MaterialsActionsBar.tsx
import Link from "next/link";

export default function MaterialsActionsBar({
  canSoftDelete,
  canWrite,
  addHref,
  multi,
  toggleMultiHref,
}: {
  canSoftDelete: boolean;
  canWrite: boolean;
  addHref: string;
  multi: boolean;
  toggleMultiHref: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {canWrite ? (
        <Link
          href={addHref}
          className="border border-border bg-foreground text-background px-3 py-2 text-sm font-medium rounded-md hover:bg-foreground/90 transition"
        >
          + Dodaj materiał
        </Link>
      ) : null}

      {canSoftDelete ? (
        <Link
          href={toggleMultiHref}
          className="border border-red-500/60 text-red-300 px-3 py-2 text-sm font-medium rounded-md bg-red-500/10 hover:bg-red-500/20 transition"
        >
          {multi ? "Zakończ zaznaczanie" : "Usuń kilka"}
        </Link>
      ) : null}
    </div>
  );
}
