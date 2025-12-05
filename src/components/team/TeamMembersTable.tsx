// src/components/team/TeamMembersTable.tsx
"use client";

import * as React from "react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";

export type VTeamMember = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  status: "invited" | "active" | "disabled";
  created_at: string | null;
  crew_id: string | null;
  crew_name: string | null;
  // UWAGA: może być null – naprawia błąd z value={null} na <select>
  account_role: "owner" | "manager" | "storeman" | "worker" | null;
};

type Props = {
  members: VTeamMember[];
  onEdit: (form: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    phone?: string | null;
    account_role?: string | null;
    crew_id?: string | null;
  }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onResendInvite: (id: string) => Promise<any>;
};

type Crew = { id: string; name: string };

export function TeamMembersTable({
  members,
  onEdit,
  onDelete,
  onResendInvite,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // --- stan dla edycji podstawowych danych ---
  const [editing, setEditing] = useState<VTeamMember | null>(null);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
  });

  // --- brygady z Supabase (klient) ---
  const [crews, setCrews] = useState<Crew[]>([]);
  const [crewsLoading, setCrewsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadCrews() {
      setCrewsLoading(true);
      try {
        const supabase = supabaseClient();
        const { data, error } = await supabase
          .from("crews")
          .select("id, name")
          .order("name", { ascending: true });

        if (!cancelled && !error && data) {
          setCrews(data as Crew[]);
        }
      } finally {
        if (!cancelled) setCrewsLoading(false);
      }
    }

    loadCrews();
    return () => {
      cancelled = true;
    };
  }, []);

  const roleLabel: Record<
    NonNullable<VTeamMember["account_role"]>,
    string
  > = {
    owner: "Właściciel",
    manager: "Manager",
    storeman: "Magazynier",
    worker: "Pracownik",
  };

  const statusLabel: Record<VTeamMember["status"], string> = {
    invited: "Zaproszony",
    active: "Aktywny",
    disabled: "Zablokowany",
  };

  const statusClass: Record<VTeamMember["status"], string> = {
    invited: "bg-amber-500/10 text-amber-300 border border-amber-500/40",
    active: "bg-emerald-500/10 text-emerald-300 border border-emerald-500/40",
    disabled: "bg-slate-500/10 text-slate-300 border border-slate-500/40",
  };

  const sortedMembers = useMemo(
    () =>
      [...members].sort((a, b) => {
        const da = a.created_at ?? "";
        const db = b.created_at ?? "";
        return da.localeCompare(db);
      }),
    [members]
  );

  // --- helpery akcji ---

  function openEditDialog(member: VTeamMember) {
    setEditing(member);
    setForm({
      first_name: member.first_name ?? "",
      last_name: member.last_name ?? "",
      email: member.email ?? "",
      phone: member.phone ?? "",
    });
  }

  function closeEditDialog() {
    setEditing(null);
  }

  function handleRowClick(id: string) {
    router.push(`/team/${id}`);
  }

  function handleChangeCrew(member: VTeamMember, crewId: string | null) {
    startTransition(async () => {
      await onEdit({ id: member.id, crew_id: crewId });
    });
  }

  // 🔹 NOWA wersja – zmiana roli idzie przez API + RPC set_member_role
  function handleChangeRole(
    member: VTeamMember,
    role: VTeamMember["account_role"]
  ) {
    if (!role) return;

    startTransition(async () => {
      try {
        const res = await fetch("/api/team/member/role", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            member_id: member.id,
            role,
          }),
        });

        const json = await res.json().catch(() => ({}));

        if (!res.ok || !json.ok) {
          console.error("[set_member_role] API error:", json);
          alert(
            json.details ||
              json.error ||
              "Nie udało się zmienić roli członka zespołu."
          );
          return;
        }

        // odśwież widok, żeby wciągnąć aktualne dane z serwera
        router.refresh();
      } catch (err) {
        console.error("[set_member_role] fetch error:", err);
        alert("Wystąpił błąd podczas zmiany roli.");
      }
    });
  }

  function handleDelete(member: VTeamMember) {
    const ok = window.confirm(
      `Czy na pewno chcesz usunąć członka zespołu "${member.first_name ?? ""} ${
        member.last_name ?? ""
      }"?`
    );
    if (!ok) return;

    startTransition(async () => {
      await onDelete(member.id);
    });
  }

  function handleResendInvite(member: VTeamMember) {
    startTransition(async () => {
      await onResendInvite(member.id);
      alert(
        "Nowe zaproszenie zostało wygenerowane (wysyłka e-mail w backendzie)."
      );
    });
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;

    startTransition(async () => {
      await onEdit({
        id: editing.id,
        first_name: form.first_name.trim() || null,
        last_name: form.last_name.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
      });
      closeEditDialog();
    });
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-card/60 shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-muted-foreground/80">
              <th className="sticky top-0 z-10 bg-card/80 px-4 py-3 text-left">
                Imię i nazwisko
              </th>
              <th className="sticky top-0 z-10 bg-card/80 px-4 py-3 text-left">
                Kontakt
              </th>
              <th className="sticky top-0 z-10 bg-card/80 px-4 py-3 text-left">
                Brygada
              </th>
              <th className="sticky top-0 z-10 bg-card/80 px-4 py-3 text-left">
                Rola
              </th>
              <th className="sticky top-0 z-10 bg-card/80 px-4 py-3 text-left">
                Status
              </th>
              <th className="sticky top-0 z-10 bg-card/80 px-4 py-3 text-right">
                Akcje
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedMembers.map((member) => (
              <tr
                key={member.id}
                className="group cursor-pointer border-t border-border/40 hover:bg-muted/40"
                onClick={() => handleRowClick(member.id)}
              >
                {/* Imię i nazwisko */}
                <td className="px-4 py-3 align-middle">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">
                      {member.first_name || member.last_name
                        ? `${member.first_name ?? ""} ${
                            member.last_name ?? ""
                          }`.trim()
                        : member.email}
                    </span>
                    {member.email && (
                      <span className="text-xs text-muted-foreground">
                        {member.email}
                      </span>
                    )}
                  </div>
                </td>

                {/* Kontakt */}
                <td className="px-4 py-3 align-middle">
                  <div className="text-xs text-muted-foreground">
                    {member.phone || "-"}
                  </div>
                </td>

                {/* Brygada + mini-menu */}
                <td
                  className="px-4 py-3 align-middle"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="inline-flex items-center gap-2 rounded-full bg-background/60 px-3 py-1 text-xs">
                    <span className="truncate max-w-[160px]">
                      {member.crew_name ?? "Brak brygady"}
                    </span>
                    <div className="relative">
                      <select
                        className="cursor-pointer bg-transparent text-[11px] text-muted-foreground outline-none"
                        value={member.crew_id ?? ""} // nigdy null
                        disabled={crewsLoading}
                        onChange={(e) =>
                          handleChangeCrew(
                            member,
                            e.target.value === "" ? null : e.target.value
                          )
                        }
                      >
                        <option value="">
                          {crewsLoading ? "Ładowanie..." : "Zmień"}
                        </option>
                        <option value="">Brak brygady</option>
                        {crews.map((crew) => (
                          <option key={crew.id} value={crew.id}>
                            {crew.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </td>

                {/* Rola + mini-menu */}
                <td
                  className="px-4 py-3 align-middle"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="inline-flex items-center gap-2 rounded-full bg-background/60 px-3 py-1 text-xs">
                    <span>
                      {member.account_role
                        ? roleLabel[member.account_role]
                        : "Brak roli"}
                    </span>
                    <select
                      className="cursor-pointer bg-transparent text-[11px] text-muted-foreground outline-none"
                      value={member.account_role ?? ""} // nigdy null
                      onChange={(e) =>
                        handleChangeRole(
                          member,
                          (e.target.value ||
                            null) as VTeamMember["account_role"]
                        )
                      }
                    >
                      <option value="">
                        {member.account_role ? "Zmień rolę" : "Wybierz rolę"}
                      </option>
                      <option value="owner">Właściciel</option>
                      <option value="manager">Manager</option>
                      <option value="storeman">Magazynier</option>
                      <option value="worker">Pracownik</option>
                    </select>
                  </div>
                </td>

                {/* Status */}
                <td className="px-4 py-3 align-middle">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${statusClass[member.status]}`}
                  >
                    {statusLabel[member.status]}
                  </span>
                </td>

                {/* Akcje */}
                <td
                  className="px-4 py-3 align-middle text-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-end gap-2 text-xs">
                    <button
                      type="button"
                      className="rounded-full border border-border/60 px-3 py-1 hover:bg-muted/60"
                      onClick={() => openEditDialog(member)}
                    >
                      Edytuj
                    </button>
                    {member.status === "invited" && (
                      <button
                        type="button"
                        className="rounded-full border border-border/60 px-3 py-1 hover:bg-muted/60"
                        onClick={() => handleResendInvite(member)}
                      >
                        Wyślij ponownie
                      </button>
                    )}
                    <button
                      type="button"
                      className="rounded-full border border-destructive/40 px-3 py-1 text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(member)}
                    >
                      Usuń
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {sortedMembers.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  Brak członków zespołu. Dodaj pierwszą osobę używając
                  formularza &bdquo;Zaproś&rdquo; u góry.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Prosty modal edycji danych */}
      {editing && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-4 shadow-xl">
            <h2 className="text-sm font-medium text-foreground">
              Edytuj dane członka
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Zmień podstawowe dane użytkownika. Rola i brygada mają osobne
              kontrolki w tabeli.
            </p>

            <form className="mt-4 space-y-3" onSubmit={handleEditSubmit}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[11px] text-muted-foreground">
                    Imię
                  </label>
                  <input
                    className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                    value={form.first_name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, first_name: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-muted-foreground">
                    Nazwisko
                  </label>
                  <input
                    className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                    value={form.last_name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, last_name: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[11px] text-muted-foreground">
                  E-mail
                </label>
                <input
                  type="email"
                  className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] text-muted-foreground">
                  Telefon
                </label>
                <input
                  className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: e.target.value }))
                  }
                />
              </div>

              <div className="mt-4 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  className="rounded-full border border-border/70 px-3 py-1.5 hover:bg-muted/60"
                  onClick={closeEditDialog}
                  disabled={isPending}
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-primary px-3 py-1.5 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
                  disabled={isPending}
                >
                  Zapisz zmiany
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default TeamMembersTable;
