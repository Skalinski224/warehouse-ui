// src/components/common/ConfirmDialog.tsx
"use client";

import React from "react";

type Props = {
  open: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
  isSubmitting?: boolean;
};

export default function ConfirmDialog({
  open,
  title = "Potwierdź akcję",
  description = "Czy na pewno chcesz kontynuować?",
  confirmLabel = "Potwierdź",
  cancelLabel = "Anuluj",
  onConfirm,
  onClose,
  isSubmitting = false,
}: Props) {
  if (!open) return null;

  async function handleConfirm() {
    await onConfirm();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-xl">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="mt-2 text-xs text-muted-foreground">{description}</p>

        <div className="mt-5 flex justify-end gap-2 text-sm">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl border border-border px-3 py-1.5 hover:bg-muted/60 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="rounded-xl bg-destructive px-3 py-1.5 font-medium text-destructive-foreground hover:opacity-90 disabled:opacity-60"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
