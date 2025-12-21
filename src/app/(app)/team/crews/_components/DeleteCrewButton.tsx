"use client";

import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";

type Props = {
  crewId: string;
  crewName: string;
  canManage?: boolean; // ✅ dodane
};

export default function DeleteCrewButton({
  crewId,
  crewName,
  canManage = false,
}: Props) {
  // ✅ worker/storeman nie widzą nic
  if (!canManage) return null;

  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setError(null);

    const confirmed = window.confirm(
      `Czy na pewno trwale usunąć brygadę: „${crewName}”?`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/team/crews/${crewId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Nie udało się usunąć brygady.");
        return;
      }

      startTransition(() => {
        router.push("/team/crews");
        router.refresh();
      });
    } catch {
      setError("Nieoczekiwany błąd sieci.");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        className="inline-flex items-center justify-center rounded-xl border border-destructive/60 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive shadow-sm transition hover:bg-destructive/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Usuwanie…" : "Usuń brygadę"}
      </button>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">
          {error}
        </div>
      )}
    </div>
  );
}
