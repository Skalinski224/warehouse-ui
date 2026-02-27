// src/components/ConfirmDialog.tsx
"use client";

import { useEffect } from "react";

export default function ConfirmDialog(props: {
  open: boolean;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;

  danger?: boolean;
  loading?: boolean;

  onClose: () => void;
  onConfirm: () => void;
}) {
  const {
    open,
    title,
    description,
    confirmText = "Potwierdź",
    cancelText = "Anuluj",
    danger = false,
    loading = false,
    onClose,
    onConfirm,
  } = props;

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-4 space-y-3 shadow-xl">
        <div className="text-sm font-semibold">{title}</div>

        {description ? (
          <div className="text-xs text-muted-foreground whitespace-pre-line">
            {description}
          </div>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border border-border px-3 py-2 text-xs disabled:opacity-50"
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={[
              "rounded-xl border px-3 py-2 text-xs font-medium disabled:opacity-50",
              danger
                ? "border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/15"
                : "border-border bg-foreground text-background hover:bg-foreground/90",
            ].join(" ")}
          >
            {loading ? "…" : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
