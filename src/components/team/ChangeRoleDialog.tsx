// src/components/team/ChangeRoleDialog.tsx
"use client";

import React, { useEffect, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  currentRole: "owner" | "manager" | "storeman" | "worker";
  onSelect: (role: "owner" | "manager" | "storeman" | "worker") => Promise<void>;
  isSubmitting?: boolean;
};

const ROLES: {
  value: "owner" | "manager" | "storeman" | "worker";
  label: string;
  warning?: string;
}[] = [
  {
    value: "owner",
    label: "Właściciel",
    warning:
      "Uwaga: rola właściciela daje pełną kontrolę nad kontem (w tym usuwanie innych właścicieli).",
  },
  { value: "manager", label: "Manager" },
  { value: "storeman", label: "Magazynier" },
  { value: "worker", label: "Pracownik" },
];

export default function ChangeRoleDialog({
  open,
  onClose,
  currentRole,
  onSelect,
  isSubmitting = false,
}: Props) {
  const [selectedRole, setSelectedRole] =
    useState<"owner" | "manager" | "storeman" | "worker">(currentRole);

  useEffect(() => {
    setSelectedRole(currentRole);
  }, [currentRole, open]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSelect(selectedRole);
    onClose();
  }

  const currentMeta = ROLES.find((r) => r.value === selectedRole);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-xl">
        <h2 className="text-sm font-semibold text-foreground">Zmień rolę</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Wybierz nową rolę dla tego członka zespołu.
        </p>

        {currentMeta?.warning && (
          <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-300">
            {currentMeta.warning}
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div className="max-h-64 space-y-1 overflow-y-auto pr-1 text-sm">
            {ROLES.map((role) => (
              <button
                key={role.value}
                type="button"
                onClick={() => setSelectedRole(role.value)}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left ${
                  selectedRole === role.value
                    ? "bg-primary/10 text-primary border border-primary/40"
                    : "hover:bg-muted/60 border border-transparent text-foreground"
                }`}
              >
                <span>{role.label}</span>
                {selectedRole === role.value && (
                  <span className="text-[11px] uppercase tracking-wide">
                    Aktualnie
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-3 text-sm">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-border px-3 py-1.5 hover:bg-muted/60 disabled:opacity-50"
            >
              Anuluj
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-primary px-3 py-1.5 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              Zapisz
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
