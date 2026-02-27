// src/app/(app)/inventory/_components/DeleteInventorySessionButton.tsx
"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ConfirmDialog";
import { deleteInventorySession } from "@/app/(app)/inventory/actions";

export default function DeleteInventorySessionButton(props: {
  sessionId: string;
  label?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function navToast(message: string, tone: "ok" | "err") {
    const url =
      `${pathname}?toast=${encodeURIComponent(message)}&tone=${encodeURIComponent(tone)}`;
    router.replace(url);
  }

  function onConfirm() {
    startTransition(async () => {
      try {
        await deleteInventorySession(props.sessionId);
        setOpen(false);

        // ✅ global toast przez query params
        navToast("Sesja inwentaryzacji została usunięta.", "ok");

        // odśwież dane (lista sesji)
        router.refresh();
      } catch (err: any) {
        console.error("DeleteInventorySession error:", err);
        setOpen(false);

        navToast(
          err?.message || "Nie udało się usunąć sesji inwentaryzacji.",
          "err"
        );
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-xs text-red-300 hover:bg-red-500/15 transition"
      >
        {props.label ?? "Usuń"}
      </button>

      <ConfirmDialog
        open={open}
        title="Usunąć sesję inwentaryzacji?"
        description={
          "Ta operacja usunie DRAFT.\nNie zmieni stanów magazynowych.\n\nNie można jej cofnąć."
        }
        confirmText="Tak, usuń"
        cancelText="Anuluj"
        danger
        loading={isPending}
        onClose={() => setOpen(false)}
        onConfirm={onConfirm}
      />
    </>
  );
}
