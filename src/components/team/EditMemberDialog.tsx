"use client";

import React from "react";
import { useCan } from "@/components/RoleGuard";
import { PERM } from "@/lib/permissions";

export type EditMemberPayload = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  member: EditMemberPayload | null;
  onSave: (payload: EditMemberPayload) => Promise<void>;
  isSubmitting?: boolean;
};

export default function EditMemberDialog({
  open,
  onClose,
  member,
  onSave,
  isSubmitting = false,
}: Props) {
  // ✅ kto w ogóle może wejść i zobaczyć dane członka
  const canOpen = useCan(PERM.TEAM_MEMBER_READ);
  if (!canOpen) return null;

  // ✅ kto może edytować dane członka (owner/manager)
  // U Ciebie nie ma TEAM_MEMBER_EDIT, więc bierzemy "admin team" z kanonu:
  const canEdit =
    useCan(PERM.TEAM_INVITE) || useCan(PERM.TEAM_MANAGE_ROLES);

  const [form, setForm] = React.useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
  });

  React.useEffect(() => {
    if (member) {
      setForm({
        first_name: member.first_name ?? "",
        last_name: member.last_name ?? "",
        email: member.email ?? "",
        phone: member.phone ?? "",
      });
    }
  }, [member]);

  if (!open || !member) return null;

  function updateField(key: keyof typeof form, value: string) {
    if (!canEdit) return; // 🔒 foreman tylko podgląd
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!member) return;
    if (!canEdit) return; // 🔒 nie zapisujemy, jeśli brak uprawnień

    await onSave({
      id: member.id,
      first_name: form.first_name.trim() || null,
      last_name: form.last_name.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
    });

    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-foreground">
          Dane członka zespołu
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {canEdit
            ? "Możesz edytować dane osobowe. Rola i brygada są edytowane z poziomu tabeli."
            : "Masz dostęp tylko do podglądu. Edycja jest zablokowana."}
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] text-muted-foreground mb-1">
                Imię
              </label>
              <input
                type="text"
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary disabled:opacity-70"
                value={form.first_name}
                onChange={(e) => updateField("first_name", e.target.value)}
                disabled={!canEdit || isSubmitting}
              />
            </div>

            <div>
              <label className="block text-[11px] text-muted-foreground mb-1">
                Nazwisko
              </label>
              <input
                type="text"
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary disabled:opacity-70"
                value={form.last_name}
                onChange={(e) => updateField("last_name", e.target.value)}
                disabled={!canEdit || isSubmitting}
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-muted-foreground mb-1">
              E-mail
            </label>
            <input
              type="email"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary disabled:opacity-70"
              value={form.email}
              onChange={(e) => updateField("email", e.target.value)}
              disabled={!canEdit || isSubmitting}
            />
          </div>

          <div>
            <label className="block text-[11px] text-muted-foreground mb-1">
              Telefon
            </label>
            <input
              type="text"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary disabled:opacity-70"
              value={form.phone}
              onChange={(e) => updateField("phone", e.target.value)}
              disabled={!canEdit || isSubmitting}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 text-sm">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-border px-4 py-2 text-foreground hover:bg-muted/60 disabled:opacity-50"
            >
              Zamknij
            </button>

            {canEdit && (
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-xl bg-primary px-4 py-2 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                Zapisz zmiany
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
