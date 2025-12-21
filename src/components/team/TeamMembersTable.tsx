// src/components/team/TeamMembersTable.tsx
"use client";

import * as React from "react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
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
  account_role: "owner" | "manager" | "foreman" | "storeman" | "worker" | null;
};

type Crew = { id: string; name: string };

type EditForm = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  account_role?: string | null;
  crew_id?: string | null;
};

type Props = {
  members: VTeamMember[];

  onEdit?: (form: EditForm) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onResendInvite?: (id: string) => Promise<any>;

  canOpenDetails: boolean;
  canChangeCrew: boolean;
  canChangeRole: boolean;
  canEditDetails: boolean;
};

function norm(s: string) {
  return (s || "").toLowerCase().trim();
}

function fullName(m: VTeamMember) {
  const n = [m.first_name, m.last_name].filter(Boolean).join(" ").trim();
  return n || (m.email ?? "—");
}

const roleLabel: Record<NonNullable<VTeamMember["account_role"]>, string> = {
  owner: "Właściciel",
  manager: "Manager",
  foreman: "Brygadzista",
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

const SEL = {
  headerCrew: "__header_crew__",
  headerRole: "__header_role__",
  none: "__none__",
} as const;

/* ----------------------------- KANON: SECTION ----------------------------- */

function SectionHeader({
  title,
  count,
  hint,
}: {
  title: string;
  count: number;
  hint?: string;
}) {
  return (
    <div className="sticky top-0 z-[5] -mx-3 mb-3 border-y border-border bg-card/90 backdrop-blur px-3 py-2 sm:-mx-4 sm:px-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-xs font-semibold tracking-wide text-foreground">
              {title}
            </div>
            <span className="rounded-full border border-border bg-background/40 px-2 py-0.5 text-[11px] text-foreground/80">
              {count}
            </span>
          </div>
          {hint ? (
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              {hint}
            </div>
          ) : null}
        </div>

        <div className="hidden sm:flex items-center gap-2">
          <span className="h-[1px] w-10 bg-border/70" />
          <span className="text-[11px] text-muted-foreground">
            sekcja
          </span>
        </div>
      </div>
    </div>
  );
}

function RoleSection({
  title,
  count,
  hint,
  children,
  emptyLabel = "Brak pozycji.",
}: {
  title: string;
  count: number;
  hint?: string;
  emptyLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="p-3 sm:p-4">
        <SectionHeader title={title} count={count} hint={hint} />
        <div className="grid gap-3">
          {count > 0 ? (
            children
          ) : (
            <div className="rounded-2xl border border-dashed border-border/70 bg-background/20 p-4 text-xs text-muted-foreground">
              {emptyLabel}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------- COMPONENT ----------------------------- */

export function TeamMembersTable({
  members,
  onEdit,
  onDelete,
  onResendInvite,
  canOpenDetails,
  canChangeCrew,
  canChangeRole,
  canEditDetails,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // lokalny stan listy + realtime refresh
  const [rows, setRows] = useState<VTeamMember[]>(members);

  // live search
  const [q, setQ] = useState("");
  const qn = norm(q);

  // edit modal
  const [editing, setEditing] = useState<VTeamMember | null>(null);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
  });

  // crews
  const [crews, setCrews] = useState<Crew[]>([]);
  const [crewsLoading, setCrewsLoading] = useState(false);

  // debouncer dla realtime refresh
  const refreshTimer = useRef<any>(null);

  useEffect(() => {
    setRows(members);
  }, [members]);

  // load crews tylko jeśli można zmieniać brygadę
  useEffect(() => {
    if (!canChangeCrew) return;

    let cancelled = false;

    async function loadCrews() {
      setCrewsLoading(true);
      try {
        const sb = supabaseClient();
        const { data, error } = await sb
          .from("crews")
          .select("id, name")
          .order("name", { ascending: true });
        if (!cancelled && !error && data) setCrews(data as Crew[]);
      } finally {
        if (!cancelled) setCrewsLoading(false);
      }
    }

    loadCrews();
    return () => {
      cancelled = true;
    };
  }, [canChangeCrew]);

  async function refreshFromDb() {
    try {
      const sb = supabaseClient();
      const { data, error } = await sb
        .from("v_team_members_view")
        .select("*")
        .order("created_at", { ascending: true });

      if (!error && data) setRows(data as VTeamMember[]);
    } catch {
      // celowo cicho – realtime nie ma rozwalać UI
    }
  }

  // realtime: każde zdarzenie na team_members -> refresh view
  useEffect(() => {
    const sb = supabaseClient();

    const ch = sb
      .channel("team_members_live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "team_members" },
        () => {
          if (refreshTimer.current) clearTimeout(refreshTimer.current);
          refreshTimer.current = setTimeout(() => {
            refreshFromDb();
          }, 250);
        }
      )
      .subscribe();

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      sb.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (!qn) return [...rows];

    return rows.filter((m) => {
      const hay = norm(
        [
          m.first_name ?? "",
          m.last_name ?? "",
          m.email ?? "",
          m.phone ?? "",
          m.crew_name ?? "",
          m.account_role ?? "",
          m.status ?? "",
        ].join(" ")
      );
      return hay.includes(qn);
    });
  }, [rows, qn]);

  // sort stabilnie po created_at
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) =>
      (a.created_at ?? "").localeCompare(b.created_at ?? "")
    );
  }, [filtered]);

  const owners = useMemo(() => sorted.filter((m) => m.account_role === "owner"), [sorted]);
  const managers = useMemo(() => sorted.filter((m) => m.account_role === "manager"), [sorted]);
  const foremen = useMemo(() => sorted.filter((m) => m.account_role === "foreman"), [sorted]);
  const storemen = useMemo(() => sorted.filter((m) => m.account_role === "storeman"), [sorted]);
  const workers = useMemo(
    () => sorted.filter((m) => !m.account_role || m.account_role === "worker"),
    [sorted]
  );

  function openEditDialog(member: VTeamMember) {
    if (!canEditDetails || !onEdit) return;
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

  function handleCardClick(id: string) {
    if (!canOpenDetails) return;
    router.push(`/team/${id}`);
  }

  function handleChangeCrew(member: VTeamMember, crewId: string | null) {
    if (!canChangeCrew || !onEdit) return;

    startTransition(async () => {
      await onEdit({ id: member.id, crew_id: crewId });
      await refreshFromDb();
    });
  }

  function handleChangeRole(member: VTeamMember, role: VTeamMember["account_role"]) {
    if (!canChangeRole) return;
    if (!role) return;

    startTransition(async () => {
      try {
        const res = await fetch("/api/team/member/role", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ member_id: member.id, role }),
        });

        const json = await res.json().catch(() => ({}));

        if (!res.ok || !json.ok) {
          console.error("[set_member_role] API error:", json);
          alert(json.details || json.error || "Nie udało się zmienić roli członka zespołu.");
          return;
        }

        await refreshFromDb();
      } catch (err) {
        console.error("[set_member_role] fetch error:", err);
        alert("Wystąpił błąd podczas zmiany roli.");
      }
    });
  }

  function handleDelete(member: VTeamMember) {
    if (!onDelete) return;

    const ok = window.confirm(
      `Czy na pewno chcesz usunąć członka zespołu "${fullName(member)}"?`
    );
    if (!ok) return;

    startTransition(async () => {
      await onDelete(member.id);
      await refreshFromDb();
    });
  }

  function handleResendInvite(member: VTeamMember) {
    if (!onResendInvite) return;

    startTransition(async () => {
      await onResendInvite(member.id);
      alert("Nowe zaproszenie zostało wygenerowane (wysyłka e-mail w backendzie).");
      await refreshFromDb();
    });
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    if (!canEditDetails || !onEdit) return;

    startTransition(async () => {
      await onEdit({
        id: editing.id,
        first_name: form.first_name.trim() || null,
        last_name: form.last_name.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
      });
      closeEditDialog();
      await refreshFromDb();
    });
  }

  const showActions =
    !!onDelete || !!onResendInvite || (canEditDetails && !!onEdit);

  function MiniField({
    label,
    value,
    right,
  }: {
    label: string;
    value: React.ReactNode;
    right?: React.ReactNode;
  }) {
    return (
      <div className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-background/40 px-3 py-1.5 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="opacity-50">·</span>
        <span className="font-medium text-foreground">{value}</span>
        {right ? <span className="ml-2">{right}</span> : null}
      </div>
    );
  }

  function MemberCard({ m }: { m: VTeamMember }) {
    const clickable = canOpenDetails;

    const crewText = m.crew_name ?? "—";
    const roleText = m.account_role ? roleLabel[m.account_role] : "—";

    const crewSelectValue = m.crew_id ? m.crew_id : SEL.none;
    const roleSelectValue = m.account_role ? m.account_role : SEL.none;

    return (
      <div
        className={[
          "rounded-2xl border border-border/70 bg-card/60 shadow-sm",
          "transition hover:bg-card/80 hover:border-foreground/15",
          clickable ? "cursor-pointer" : "cursor-default",
        ].join(" ")}
        onClick={() => clickable && handleCardClick(m.id)}
      >
        <div className="p-3 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-[15px] font-semibold text-foreground leading-snug">
                {fullName(m)}
              </div>

              <div className="mt-1 text-xs text-muted-foreground md:hidden leading-snug">
                <span className="block truncate">{m.email ?? "—"}</span>
                <span className="block truncate">{m.phone ?? "—"}</span>
                <span className="block truncate">{crewText}</span>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1.5">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${statusClass[m.status]}`}
              >
                {statusLabel[m.status]}
              </span>

              <span className="inline-flex items-center rounded-full border border-border/70 bg-background/50 px-2.5 py-0.5 text-[11px] text-foreground/80">
                {roleText}
              </span>
            </div>
          </div>

          <div
            className="hidden md:flex flex-wrap items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <MiniField label="Email" value={m.email ?? "—"} />
            <MiniField label="Telefon" value={m.phone ?? "—"} />

            <MiniField
              label="Brygada"
              value={crewText}
              right={
                canChangeCrew && onEdit ? (
                  <select
                    className="bg-transparent text-[11px] text-muted-foreground outline-none cursor-pointer"
                    value={crewSelectValue}
                    disabled={crewsLoading}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === SEL.headerCrew) return;
                      handleChangeCrew(m, v === SEL.none ? null : v);
                    }}
                  >
                    <option value={SEL.headerCrew} disabled>
                      Zmień…
                    </option>
                    <option value={SEL.none}>—</option>
                    {crews.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                ) : null
              }
            />

            <MiniField
              label="Rola"
              value={roleText}
              right={
                canChangeRole ? (
                  <select
                    className="bg-transparent text-[11px] text-muted-foreground outline-none cursor-pointer"
                    value={roleSelectValue}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === SEL.headerRole) return;
                      handleChangeRole(
                        m,
                        (v === SEL.none ? null : (v as VTeamMember["account_role"])) as VTeamMember["account_role"]
                      );
                    }}
                  >
                    <option value={SEL.headerRole} disabled>
                      Zmień…
                    </option>
                    <option value={SEL.none}>—</option>
                    <option value="owner">Właściciel</option>
                    <option value="manager">Manager</option>
                    <option value="foreman">Brygadzista</option>
                    <option value="storeman">Magazynier</option>
                    <option value="worker">Pracownik</option>
                  </select>
                ) : null
              }
            />
          </div>

          {showActions ? (
            <div
              className="mt-0.5 flex items-center justify-end gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              {canEditDetails && onEdit ? (
                <button
                  type="button"
                  className="rounded-xl border border-border/70 bg-background/40 px-3 py-1.5 text-xs hover:bg-background/60"
                  onClick={() => openEditDialog(m)}
                  disabled={isPending}
                >
                  Edytuj
                </button>
              ) : null}

              {onResendInvite && m.status === "invited" ? (
                <button
                  type="button"
                  className="rounded-xl border border-border/70 bg-background/40 px-3 py-1.5 text-xs hover:bg-background/60"
                  onClick={() => handleResendInvite(m)}
                  disabled={isPending}
                >
                  Wyślij ponownie
                </button>
              ) : null}

              {onDelete ? (
                <button
                  type="button"
                  className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-200 hover:bg-rose-500/15"
                  onClick={() => handleDelete(m)}
                  disabled={isPending}
                >
                  Usuń
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Live search (kanon) */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="text-sm font-medium">Lista członków</div>
            <div className="text-xs text-muted-foreground">
              Podzielone na role. W sekcjach od razu widać gdzie kończy się jedna grupa i zaczyna druga.
            </div>
          </div>

          <div className="w-full md:max-w-[520px]">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Szukaj (imię, nazwisko, email, telefon, brygada)…"
              className="w-full rounded-xl border border-border bg-background/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/15"
            />
          </div>
        </div>

        <div className="mt-2 text-[11px] text-muted-foreground">
          Wyników: <span className="text-foreground/80 font-medium">{sorted.length}</span>
          {isPending ? <span className="ml-2 opacity-70">· aktualizuję…</span> : null}
        </div>
      </div>

      {/* SEKCJE: wyraźne odcięcia */}
      <div className="grid gap-4">
        <RoleSection title="Właściciel" count={owners.length} hint="Najwyższe uprawnienia na koncie.">
          {owners.map((m) => (
            <MemberCard key={m.id} m={m} />
          ))}
        </RoleSection>

        <RoleSection title="Manager" count={managers.length} hint="Zarządzanie modułami, raportami i zespołem.">
          {managers.map((m) => (
            <MemberCard key={m.id} m={m} />
          ))}
        </RoleSection>

        <RoleSection title="Brygadzista" count={foremen.length} hint="Prowadzący brygadę (zadania, załoga, prace).">
          {foremen.map((m) => (
            <MemberCard key={m.id} m={m} />
          ))}
        </RoleSection>

        <RoleSection title="Magazynier" count={storemen.length} hint="Dostawy, stany, operacje magazynowe.">
          {storemen.map((m) => (
            <MemberCard key={m.id} m={m} />
          ))}
        </RoleSection>

        <RoleSection title="Pracownik" count={workers.length} hint="Raporty dzienne i praca w zadaniach.">
          {workers.map((m) => (
            <MemberCard key={m.id} m={m} />
          ))}
        </RoleSection>
      </div>

      {/* Modal edycji danych */}
      {editing && canEditDetails && onEdit ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl border border-border/70 bg-card/90 shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-foreground">Edytuj dane</div>
                <div className="text-xs text-muted-foreground">
                  Zmień podstawowe dane użytkownika. Rola i brygada są osobno.
                </div>
              </div>

              <button
                type="button"
                onClick={closeEditDialog}
                className="rounded-xl border border-border/70 bg-background/40 px-3 py-2 text-xs hover:bg-background/60"
                disabled={isPending}
              >
                Zamknij
              </button>
            </div>

            <form className="px-5 py-4 space-y-3" onSubmit={handleEditSubmit}>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <div className="text-[11px] text-muted-foreground">Imię</div>
                  <input
                    className="w-full rounded-xl border border-border/70 bg-background/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/15"
                    value={form.first_name}
                    onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                  />
                </label>

                <label className="space-y-1">
                  <div className="text-[11px] text-muted-foreground">Nazwisko</div>
                  <input
                    className="w-full rounded-xl border border-border/70 bg-background/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/15"
                    value={form.last_name}
                    onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                  />
                </label>
              </div>

              <label className="space-y-1">
                <div className="text-[11px] text-muted-foreground">Email</div>
                <input
                  type="email"
                  className="w-full rounded-xl border border-border/70 bg-background/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/15"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </label>

              <label className="space-y-1">
                <div className="text-[11px] text-muted-foreground">Telefon</div>
                <input
                  className="w-full rounded-xl border border-border/70 bg-background/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/15"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </label>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  className="rounded-xl border border-border/70 bg-background/40 px-3 py-2 text-xs hover:bg-background/60"
                  onClick={closeEditDialog}
                  disabled={isPending}
                >
                  Anuluj
                </button>

                <button
                  type="submit"
                  className="rounded-xl border border-border/70 bg-foreground/15 px-3 py-2 text-xs font-semibold hover:bg-foreground/20 disabled:opacity-60"
                  disabled={isPending}
                >
                  {isPending ? "Zapisuję…" : "Zapisz"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default TeamMembersTable;
