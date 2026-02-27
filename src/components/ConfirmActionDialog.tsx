// src/components/ConfirmActionDialog.tsx
"use client";

import { useState } from "react";

export default function ConfirmActionDialog({
  triggerLabel,
  triggerClassName,
  title,
  body,
  confirmLabel = "Tak, usuń",
  cancelLabel = "Anuluj",
  confirmClassName,
  action,
  disabled,
}: {
  triggerLabel: string;
  triggerClassName: string;
  title: string;
  body: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmClassName: string;
  action: () => void | Promise<void>; // server action
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={triggerClassName}
      >
        {triggerLabel}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[900] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
          />

          <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl">
            <div className="text-sm font-semibold">{title}</div>
            <div className="mt-2 text-xs text-muted-foreground space-y-2">{body}</div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl border border-border bg-card px-4 py-2 text-xs hover:bg-card/80 transition"
              >
                {cancelLabel}
              </button>

              <form action={action}>
                <button
                  type="submit"
                  className={confirmClassName}
                >
                  {confirmLabel}
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
