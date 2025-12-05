"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { softDeletePlaceDeep } from "@/app/(app)/object/actions";

type Props = {
  placeId: string;
  parentId: string | null;
};

export default function PlaceDeleteButton({ placeId, parentId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const targetAfterDelete = parentId ? `/object/${parentId}` : "/object";

  const handleClick = () => {
    const ok = window.confirm(
      "Na pewno usunąć to miejsce wraz z pod-miejscami i wszystkimi zadaniami? To soft delete – ale operacja jest poważna."
    );
    if (!ok) return;

    startTransition(async () => {
      await softDeletePlaceDeep(placeId);
      router.push(targetAfterDelete);
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="inline-flex items-center rounded-lg border border-red-500/60 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/20 disabled:opacity-60"
    >
      {isPending ? "Usuwanie..." : "Usuń to miejsce"}
    </button>
  );
}
