// src/components/team/TeamMembersTable.tsx
"use client";

import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

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

function pushToast(
  router: ReturnType<typeof useRouter>,
  pathname: string,
  sp: URLSearchParams,
  msg: string,
  tone: "ok" | "err" = "ok"
) {
  const p = new URLSearchParams(sp.toString());
  p.set("toast", encodeURIComponent(msg));
  p.set("tone", tone);
  router.replace(`${pathname}?${p.toString()}`);
}

/* ----------------------------- UI: SECTION ----------------------------- */

function SectionHeader({
  title,
  count,
  hint,
  right,
}: {
  title: string;
  count: number;
  hint?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold leading-tight">{title}</div>
          <span className="rounded-full border border-border bg-background/20 px-2 py-0.5 text-[11px] opacity-80">
            {count}
          </span>
        </div>
        {hint ? <div className="mt-1 text-xs opacity-70">{hint}</div> : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

function MobileAccordion({
  title,
  count,
  hint,
  defaultOpen,
  children,
}: {
  title: string;
  count: number;
  hint?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="md:hidden rounded-2xl border border-border bg-card overflow-hidden" open={!!defaultOpen}>
      <summary className="list-none cursor-pointer select-none">
        <div className="p-4">
          <SectionHeader
            title={title}
            count={count}
            hint={hint}
            right={
              <span className="text-xs opacity-70">
                Rozwiń <span className="opacity-70">▾</span>
              </span>
            }
          />
        </div>
        <div className="h-px bg-border/70" />
      </summary>

      <div className="p-4 pt-3">
        {count > 0 ? (
          <div className="grid gap-3 grid-cols-1">{children}</div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border/70 bg-background/20 p-4 text-xs opacity-70">
            Brak osób w tej sekcji.
          </div>
        )}
      </div>
    </details>
  );
}

function DesktopSection({
  title,
  count,
  hint,
  children,
}: {
  title: string;
  count: number;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="hidden md:block rounded-2xl border border-border bg-card overflow-hidden">
      <div className="p-4">
        <SectionHeader title={title} count={count} hint={hint} />
      </div>
      <div className="h-px bg-border/70" />
      <div className="p-4 pt-3">
        {count > 0 ? (
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2">{children}</div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border/70 bg-background/20 p-4 text-xs opacity-70">
            Brak osób w tej sekcji.
          </div>
        )}
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
  const pathname = usePathname();
  const sp = useSearchParams();

  const [rows, setRows] = useState<VTeamMember[]>(members);
  const [q, setQ] = useState("");
  const qn = norm(q);

  const [editing, setEditing] = useState<VTeamMember | null>(null);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
  });

  const [crews, setCrews] = useState<Crew[]>([]);
  const [crewsLoading, setCrewsLoading] = useState(false);

  const refreshTimer = useRef<any>(null);

  useEffect(() => {
    setRows(members);
  }, [members]);

  useEffect(() => {
    if (!canChangeCrew) return;

    let cancelled = false;

    async function loadCrews() {
      setCrewsLoading(true);
      try {
        const sb = supabaseClient();
        const { data, error } = await sb.from("crews").select("id, name").order("name", { ascending: true });
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
      const { data, error } = await sb.from("v_team_members_view").select("*").order("created_at", { ascending: true });
      if (!error && data) setRows(data as VTeamMember[]);
    } catch {
      // celowo cicho
    }
  }

  useEffect(() => {
    const sb = supabaseClient();

    const ch = sb
      .channel("team_members_live")
      .on("postgres_changes", { event: "*", schema: "public", table: "team_members" }, () => {
        if (refreshTimer.current) clearTimeout(refreshTimer.current);
        refreshTimer.current = setTimeout(() => refreshFromDb(), 250);
      })
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

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""));
  }, [filtered]);

  const owners = useMemo(() => sorted.filter((m) => m.account_role === "owner"), [sorted]);
  const managers = useMemo(() => sorted.filter((m) => m.account_role === "manager"), [sorted]);
  const foremen = useMemo(() => sorted.filter((m) => m.account_role === "foreman"), [sorted]);
  const storemen = useMemo(() => sorted.filter((m) => m.account_role === "storeman"), [sorted]);
  const workers = useMemo(() => sorted.filter((m) => !m.account_role || m.account_role === "worker"), [sorted]);

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

  async function handleChangeCrew(member: VTeamMember, crewId: string | null) {
    if (!canChangeCrew || !onEdit) return;

    try {
      await onEdit({ id: member.id, crew_id: crewId });
      pushToast(router, pathname, new URLSearchParams(sp.toString()), "Zmieniono brygadę.", "ok");
      await refreshFromDb();
    } catch (e: any) {
      console.error("[TeamMembersTable] change crew error:", e);
      pushToast(router, pathname, new URLSearchParams(sp.toString()), e?.message || "Nie udało się zmienić brygady.", "err");
    }
  }

  async function handleChangeRole(member: VTeamMember, role: VTeamMember["account_role"]) {
    if (!canChangeRole) return;
    if (!role) return;

    try {
      const res = await fetch("/api/team/member/role", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ member_id: member.id, role }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        console.error("[set_member_role] API error:", json);
        pushToast(
          router,
          pathname,
          new URLSearchParams(sp.toString()),
          json.details || json.error || "Nie udało się zmienić roli.",
          "err"
        );
        return;
      }

      pushToast(router, pathname, new URLSearchParams(sp.toString()), "Zmieniono rolę.", "ok");
      await refreshFromDb();
    } catch (err) {
      console.error("[set_member_role] fetch error:", err);
      pushToast(router, pathname, new URLSearchParams(sp.toString()), "Wystąpił błąd podczas zmiany roli.", "err");
    }
  }

  async function handleDelete(member: VTeamMember) {
    if (!onDelete) return;

    const ok = window.confirm(`Czy na pewno chcesz usunąć "${fullName(member)}"?`);
    if (!ok) return;

    try {
      await onDelete(member.id);
      pushToast(router, pathname, new URLSearchParams(sp.toString()), "Usunięto członka zespołu.", "ok");
      await refreshFromDb();
    } catch (e: any) {
      console.error("[TeamMembersTable] delete error:", e);
      pushToast(router, pathname, new URLSearchParams(sp.toString()), e?.message || "Nie udało się usunąć członka zespołu.", "err");
    }
  }

  async function handleResendInvite(member: VTeamMember) {
    if (!onResendInvite) return;

    try {
      await onResendInvite(member.id);
      pushToast(router, pathname, new URLSearchParams(sp.toString()), "Zaproszenie odświeżone i wysłane ponownie.", "ok");
      await refreshFromDb();
    } catch (e: any) {
      console.error("[TeamMembersTable] resend invite error:", e);
      pushToast(router, pathname, new URLSearchParams(sp.toString()), e?.message || "Nie udało się wysłać zaproszenia ponownie.", "err");
    }
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    if (!canEditDetails || !onEdit) return;

    try {
      await onEdit({
        id: editing.id,
        first_name: form.first_name.trim() || null,
        last_name: form.last_name.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
      });

      closeEditDialog();
      pushToast(router, pathname, new URLSearchParams(sp.toString()), "Zapisano dane członka zespołu.", "ok");
      await refreshFromDb();
    } catch (e: any) {
      console.error("[TeamMembersTable] edit error:", e);
      pushToast(router, pathname, new URLSearchParams(sp.toString()), e?.message || "Nie udało się zapisać zmian.", "err");
    }
  }

  const showActions = !!onDelete || !!onResendInvite || (canEditDetails && !!onEdit);

  function MiniField({ label, value }: { label: string; value: React.ReactNode }) {
    return (
      <div className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-background/30 px-3 py-1.5 text-xs">
        <span className="opacity-70">{label}</span>
        <span className="opacity-40">·</span>
        <span className="font-medium">{value}</span>
      </div>
    );
  }

  function DetailButton({ id, full }: { id: string; full?: boolean }) {
    if (!canOpenDetails) return null;

    return (
      <button
        type="button"
        className={cx(
          "inline-flex items-center justify-center rounded-2xl border px-3 py-2 text-xs font-semibold transition",
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/14",
          full ? "w-full" : ""
        )}
        onClick={(e) => {
          e.stopPropagation();
          handleCardClick(id);
        }}
      >
        Sprawdź szczegóły →
      </button>
    );
  }

  function MemberCard({ m }: { m: VTeamMember }) {
    const clickable = canOpenDetails;

    const crewText = m.crew_name ?? "—";
    const roleText = m.account_role ? roleLabel[m.account_role] : "—";

    const crewSelectValue = m.crew_id ? m.crew_id : SEL.none;
    const roleSelectValue = m.account_role ? m.account_role : SEL.none;

    const cardBase = "rounded-2xl border border-border bg-background/10 transition overflow-hidden";
    const cardHover = clickable
      ? "hover:bg-background/18 hover:border-border/90 focus-within:ring-2 focus-within:ring-foreground/25 cursor-pointer"
      : "cursor-default";

    return (
      <div
        className={cx(cardBase, cardHover)}
        onClick={() => clickable && handleCardClick(m.id)}
        role={clickable ? "button" : undefined}
        aria-disabled={!clickable}
      >
        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold leading-snug">{fullName(m)}</div>

              <div className="mt-1 text-xs opacity-75 md:hidden space-y-0.5">
                <div className="truncate">{m.email ?? "—"}</div>
                <div className="truncate">
                  {crewText} <span className="opacity-50">•</span> {m.phone ?? "—"}
                </div>
              </div>

              <div className="hidden md:flex flex-wrap items-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                <MiniField label="Email" value={m.email ?? "—"} />
                <MiniField label="Telefon" value={m.phone ?? "—"} />
                <MiniField label="Brygada" value={crewText} />
              </div>
            </div>

            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium", statusClass[m.status])}>
                {statusLabel[m.status]}
              </span>

              <span className="inline-flex items-center rounded-full border border-border/70 bg-background/20 px-2.5 py-0.5 text-[11px] opacity-80">
                {roleText}
              </span>

              <div className="hidden md:block">
                <DetailButton id={m.id} />
              </div>
            </div>
          </div>

          {(canChangeCrew || canChangeRole) ? (
            <div className="hidden md:flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
              {canChangeCrew && onEdit ? (
                <div className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-background/30 px-3 py-1.5 text-xs">
                  <span className="opacity-70">Brygada</span>
                  <span className="opacity-40">·</span>
                  <select
                    className="bg-transparent text-xs outline-none cursor-pointer"
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
                </div>
              ) : null}

              {canChangeRole ? (
                <div className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-background/30 px-3 py-1.5 text-xs">
                  <span className="opacity-70">Rola</span>
                  <span className="opacity-40">·</span>
                  <select
                    className="bg-transparent text-xs outline-none cursor-pointer"
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
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="md:hidden">
            <DetailButton id={m.id} full />
          </div>

          {showActions ? (
            <div className="pt-2 border-t border-border/70 flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
              {canEditDetails && onEdit ? (
                <button
                  type="button"
                  className="rounded-xl border border-border/70 bg-background/40 px-3 py-1.5 text-xs hover:bg-background/60"
                  onClick={() => openEditDialog(m)}
                >
                  Edytuj
                </button>
              ) : null}

              {onResendInvite && m.status === "invited" ? (
                <button
                  type="button"
                  className="rounded-xl border border-border/70 bg-background/40 px-3 py-1.5 text-xs hover:bg-background/60"
                  onClick={() => handleResendInvite(m)}
                >
                  Wyślij ponownie
                </button>
              ) : null}

              {onDelete ? (
                <button
                  type="button"
                  className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-200 hover:bg-rose-500/15"
                  onClick={() => handleDelete(m)}
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
      <div className="rounded-2xl border border-border bg-background/10 p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="text-sm font-semibold">Członkowie</div>
            <div className="text-xs opacity-70 mt-1">Szukaj po imieniu, mailu, telefonie albo brygadzie.</div>
          </div>

          <div className="w-full md:max-w-[520px]">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Szukaj…"
              className="w-full rounded-xl border border-border bg-background/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/15"
            />
          </div>
        </div>

        <div className="mt-2 text-[11px] opacity-70">
          Wyników: <span className="font-medium opacity-90">{sorted.length}</span>
        </div>
      </div>

      <div className="grid gap-4">
        <MobileAccordion title="Właściciel" count={owners.length} hint="Najwyższe uprawnienia." defaultOpen={false}>
          {owners.map((m) => <MemberCard key={m.id} m={m} />)}
        </MobileAccordion>
        <DesktopSection title="Właściciel" count={owners.length} hint="Najwyższe uprawnienia.">
          {owners.map((m) => <MemberCard key={m.id} m={m} />)}
        </DesktopSection>

        <MobileAccordion title="Manager" count={managers.length} hint="Zarządzanie modułami i zespołem.">
          {managers.map((m) => <MemberCard key={m.id} m={m} />)}
        </MobileAccordion>
        <DesktopSection title="Manager" count={managers.length} hint="Zarządzanie modułami i zespołem.">
          {managers.map((m) => <MemberCard key={m.id} m={m} />)}
        </DesktopSection>

        <MobileAccordion title="Brygadzista" count={foremen.length} hint="Prowadzenie brygady.">
          {foremen.map((m) => <MemberCard key={m.id} m={m} />)}
        </MobileAccordion>
        <DesktopSection title="Brygadzista" count={foremen.length} hint="Prowadzenie brygady.">
          {foremen.map((m) => <MemberCard key={m.id} m={m} />)}
        </DesktopSection>

        <MobileAccordion title="Magazynier" count={storemen.length} hint="Operacje magazynowe.">
          {storemen.map((m) => <MemberCard key={m.id} m={m} />)}
        </MobileAccordion>
        <DesktopSection title="Magazynier" count={storemen.length} hint="Operacje magazynowe.">
          {storemen.map((m) => <MemberCard key={m.id} m={m} />)}
        </DesktopSection>

        <MobileAccordion title="Pracownik" count={workers.length} hint="Codzienna praca i raporty.">
          {workers.map((m) => <MemberCard key={m.id} m={m} />)}
        </MobileAccordion>
        <DesktopSection title="Pracownik" count={workers.length} hint="Codzienna praca i raporty.">
          {workers.map((m) => <MemberCard key={m.id} m={m} />)}
        </DesktopSection>
      </div>

      {editing && canEditDetails && onEdit ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl border border-border/70 bg-card/90 shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-foreground">Edytuj dane</div>
                <div className="text-xs text-muted-foreground">Podstawowe dane. Rola i brygada są osobno.</div>
              </div>

              <button
                type="button"
                onClick={closeEditDialog}
                className="rounded-xl border border-border/70 bg-background/40 px-3 py-2 text-xs hover:bg-background/60"
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
                >
                  Anuluj
                </button>

                <button
                  type="submit"
                  className="rounded-xl border border-border/70 bg-foreground/15 px-3 py-2 text-xs font-semibold hover:bg-foreground/20"
                >
                  Zapisz
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