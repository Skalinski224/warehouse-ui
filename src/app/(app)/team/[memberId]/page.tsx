// src/app/(app)/team/[memberId]/page.tsx
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import BackButton from "@/components/BackButton";
import { supabaseServer } from "@/lib/supabaseServer";
import { PERM, can, canAny, type PermissionSnapshot } from "@/lib/permissions";

import ForcePasswordResetButton from "@/components/team/ForcePasswordResetButton";
import AutoSubmitSelect from "@/components/team/AutoSubmitSelect";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const SEL = { none: "__none__" } as const;

function unwrapSnapshot(data: unknown): PermissionSnapshot | null {
  if (!data) return null;
  if (Array.isArray(data)) return (data[0] as PermissionSnapshot) ?? null;
  return data as PermissionSnapshot;
}

async function fetchMyPermissionsSnapshot(): Promise<PermissionSnapshot | null> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("my_permissions_snapshot");
  if (error) {
    console.error("my_permissions_snapshot error:", error);
    return null;
  }
  return unwrapSnapshot(data);
}

function toastQS(tone: "ok" | "err", title: string, msg?: string) {
  const qs = new URLSearchParams();
  qs.set("toast", tone);
  qs.set("title", title);
  if (msg) qs.set("msg", msg);
  return `?${qs.toString()}`;
}

function requirePerm(snapshot: PermissionSnapshot | null, key: any, msg?: string) {
  if (!can(snapshot, key)) throw new Error(msg ?? "Brak uprawnień.");
}

const statusLabel = {
  invited: "Zaproszony",
  active: "Aktywny",
  disabled: "Zablokowany",
} as const;

const statusClass = {
  invited: "bg-amber-500/10 text-amber-200 border border-amber-500/35",
  active: "bg-emerald-500/10 text-emerald-200 border border-emerald-500/35",
  disabled: "bg-slate-500/10 text-slate-200 border border-slate-500/35",
} as const;

const roleLabel = {
  owner: "Właściciel",
  manager: "Manager",
  foreman: "Brygadzista",
  storeman: "Magazynier",
  worker: "Pracownik",
} as const;

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function Tile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  tone?: "neutral" | "info" | "ok";
}) {
  const toneCls =
    tone === "ok"
      ? "border-emerald-500/30 bg-emerald-500/8"
      : tone === "info"
      ? "border-sky-500/25 bg-sky-500/8"
      : "border-border/70 bg-background/20";

  return (
    <div className={cx("rounded-2xl border p-4", toneCls)}>
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/80">
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-semibold text-foreground/90">
        {value}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SERVER ACTIONS (z toast)                                             */
/* ------------------------------------------------------------------ */

async function resendInviteAction(formData: FormData) {
  "use server";

  const memberId = String(formData.get("memberId") || "").trim();
  if (!memberId) return;

  const supabase = await supabaseServer();
  const snapshot = await fetchMyPermissionsSnapshot();
  requirePerm(snapshot, PERM.TEAM_INVITE, "Brak uprawnień do ponawiania zaproszeń.");

  const { error } = await supabase.rpc("rotate_invite_token", { p_member_id: memberId });
  if (error) {
    console.error("rotate_invite_token error:", error);
    redirect(`/team/${memberId}${toastQS("err", "Nie udało się wysłać", "Spróbuj ponownie.")}`);
  }

  redirect(`/team/${memberId}${toastQS("ok", "Zaproszenie odświeżone", "Nowy link został wygenerowany.")}`);
}

async function deleteMemberAction(formData: FormData) {
  "use server";

  const memberId = String(formData.get("memberId") || "").trim();
  if (!memberId) return;

  const supabase = await supabaseServer();
  const snapshot = await fetchMyPermissionsSnapshot();
  requirePerm(snapshot, PERM.TEAM_REMOVE, "Brak uprawnień do usuwania członków zespołu.");

  const { error } = await supabase.rpc("delete_team_member", { p_member_id: memberId });
  if (error) {
    console.error("delete_team_member error:", error);
    redirect(`/team/${memberId}${toastQS("err", "Nie udało się usunąć", "Sprawdź uprawnienia lub spróbuj ponownie.")}`);
  }

  redirect(`/team${toastQS("ok", "Usunięto członka", "Osoba została usunięta z konta.")}`);
}

async function updateCrewAction(formData: FormData) {
  "use server";

  const memberId = String(formData.get("memberId") || "").trim();
  if (!memberId) return;

  const crewRaw = String(formData.get("crew_id") || "").trim();
  const crew_id = crewRaw === SEL.none ? null : crewRaw || null;

  const supabase = await supabaseServer();
  const snapshot = await fetchMyPermissionsSnapshot();
  requirePerm(snapshot, PERM.TEAM_MANAGE_CREWS, "Brak uprawnień do zmiany brygady.");

  const { error } = await supabase.from("team_members").update({ crew_id }).eq("id", memberId);
  if (error) {
    console.error("team_members update crew error:", error);
    redirect(`/team/${memberId}${toastQS("err", "Nie udało się zmienić brygady")}`);
  }

  redirect(`/team/${memberId}${toastQS("ok", "Brygada zaktualizowana")}`);
}

async function updateRoleAction(formData: FormData) {
  "use server";

  const memberId = String(formData.get("memberId") || "").trim();
  if (!memberId) return;

  const role = String(formData.get("account_role") || "").trim();

  const supabase = await supabaseServer();
  const snapshot = await fetchMyPermissionsSnapshot();
  requirePerm(snapshot, PERM.TEAM_MANAGE_ROLES, "Brak uprawnień do zmiany roli.");

  const allowed = ["owner", "manager", "foreman", "storeman", "worker"] as const;
  if (!allowed.includes(role as any)) {
    redirect(`/team/${memberId}${toastQS("err", "Nieprawidłowa rola")}`);
  }

  const { error } = await supabase.rpc("set_member_role", {
    p_member_id: memberId,
    p_role: role,
  });

  if (error) {
    console.error("set_member_role error:", error);
    redirect(`/team/${memberId}${toastQS("err", "Nie udało się zmienić roli")}`);
  }

  redirect(`/team/${memberId}${toastQS("ok", "Rola zaktualizowana")}`);
}

async function updateDetailsAction(formData: FormData) {
  "use server";

  const memberId = String(formData.get("memberId") || "").trim();
  if (!memberId) return;

  const first_name = String(formData.get("first_name") || "").trim() || null;
  const last_name = String(formData.get("last_name") || "").trim() || null;
  const email = String(formData.get("email") || "").trim().toLowerCase() || null;
  const phone = String(formData.get("phone") || "").trim() || null;

  const supabase = await supabaseServer();
  const snapshot = await fetchMyPermissionsSnapshot();
  requirePerm(snapshot, PERM.TEAM_MANAGE_ROLES, "Brak uprawnień do edycji danych.");

  const { error } = await supabase
    .from("team_members")
    .update({ first_name, last_name, email, phone })
    .eq("id", memberId);

  if (error) {
    console.error("team_members update details error:", error);
    redirect(`/team/${memberId}${toastQS("err", "Nie udało się zapisać zmian")}`);
  }

  redirect(`/team/${memberId}${toastQS("ok", "Zapisano zmiany")}`);
}

/* ------------------------------------------------------------------ */
/* PAGE                                                                 */
/* ------------------------------------------------------------------ */

type PageProps = { params: Promise<{ memberId: string }> };

export default async function TeamMemberDetailPage(props: PageProps) {
  const { memberId } = await props.params;

  const supabase = await supabaseServer();
  const snapshot = await fetchMyPermissionsSnapshot();

  const canOpenDetails = canAny(snapshot, [
    PERM.TEAM_MANAGE_CREWS,
    PERM.TEAM_MANAGE_ROLES,
    PERM.TEAM_INVITE,
    PERM.TEAM_REMOVE,
    PERM.TEAM_MEMBER_FORCE_RESET,
  ]);
  if (!canOpenDetails) notFound();

  const { data, error } = await supabase
    .from("v_team_members_view")
    .select("*")
    .eq("id", memberId)
    .maybeSingle();

  if (error) {
    console.error("v_team_members_view error:", error);
    notFound();
  }
  if (!data) notFound();

  const member = data as {
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

  const fullName =
    [member.first_name, member.last_name].filter(Boolean).join(" ") ||
    member.email ||
    "Członek zespołu";

  const canInvite = can(snapshot, PERM.TEAM_INVITE);
  const canRemove = can(snapshot, PERM.TEAM_REMOVE);
  const canForceReset = can(snapshot, PERM.TEAM_MEMBER_FORCE_RESET);
  const canChangeCrew = can(snapshot, PERM.TEAM_MANAGE_CREWS);
  const canChangeRole = can(snapshot, PERM.TEAM_MANAGE_ROLES);
  const canEditDetails = can(snapshot, PERM.TEAM_MANAGE_ROLES);

  const isManageView = !!(canChangeCrew || canChangeRole || canEditDetails);
  const isReadOnlyView = !isManageView;

  const { data: crewsData } = await supabase
    .from("crews")
    .select("id, name")
    .order("name", { ascending: true });

  const crews = (crewsData ?? []) as Array<{ id: string; name: string }>;

  const crewText = member.crew_name ?? "—";
  const roleText = member.account_role ? roleLabel[member.account_role] : "—";

  const crewSelectValue = member.crew_id ? member.crew_id : SEL.none;
  const roleSelectValue = member.account_role ?? "worker";

  return (
    <section className="flex flex-col gap-4">
      {/* Header: back + breadcrumbs */}
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">
            <Link href="/team" className="hover:text-foreground hover:underline">
              Zespół
            </Link>{" "}
            <span className="opacity-60">/</span>{" "}
            <span className="text-foreground/90">Szczegóły</span>
          </div>

          <h1 className="mt-1 truncate text-xl font-semibold tracking-tight text-foreground md:text-2xl">
            {fullName}
          </h1>

          {member.email ? (
            <div className="mt-1 text-sm text-muted-foreground truncate">
              {member.email}
            </div>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={cx("inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium", statusClass[member.status])}>
              {statusLabel[member.status]}
            </span>

            <span className="inline-flex items-center rounded-full border border-border/70 bg-background/30 px-2.5 py-1 text-[11px] text-foreground/85">
              {roleText}
            </span>

            {isReadOnlyView ? (
              <span className="inline-flex items-center rounded-full border border-sky-500/25 bg-sky-500/10 px-2.5 py-1 text-[11px] text-sky-200">
                Podgląd
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-200">
                Zarządzanie
              </span>
            )}
          </div>
        </div>

        <div className="shrink-0">
          <BackButton />
        </div>
      </header>

      {/* Info */}
      <div className="rounded-2xl border border-border/70 bg-card/60 overflow-hidden">
        <div className="p-4">
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-12 md:col-span-6">
              <Tile label="E-mail" value={member.email ?? "—"} tone="info" />
            </div>
            <div className="col-span-12 md:col-span-6">
              <Tile label="Telefon" value={member.phone ?? "—"} tone="info" />
            </div>

            <div className="col-span-12 md:col-span-6">
              <Tile label="Brygada" value={crewText} tone="neutral" />
            </div>
            <div className="col-span-12 md:col-span-6">
              <Tile label="Rola" value={roleText} tone="neutral" />
            </div>
          </div>

          {/* Manage (no dublowanie): tylko jeśli ma prawa */}
          {isManageView ? (
            <div className="mt-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4">
              <div className="text-sm font-semibold text-foreground">
                Ustawienia członka
              </div>

              <div className="mt-3 grid grid-cols-12 gap-2">
                <div className="col-span-12 md:col-span-6">
                  <div className="rounded-2xl border border-border/70 bg-background/20 p-4">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/80">
                      Brygada
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-foreground/90">
                          {crewText}
                        </div>
                      </div>

                      {canChangeCrew ? (
                        <AutoSubmitSelect
                          name="crew_id"
                          defaultValue={crewSelectValue}
                          action={updateCrewAction}
                          hidden={{ memberId: member.id }}
                          className="rounded-xl border border-border/70 bg-background/30 px-3 py-2 text-xs font-semibold text-foreground/85 hover:bg-background/40"
                          options={[
                            { value: SEL.none, label: "—" },
                            ...crews.map((c) => ({ value: c.id, label: c.name })),
                          ]}
                          toast={{
                            okTitle: "Brygada zaktualizowana",
                            errTitle: "Nie udało się zmienić brygady",
                          }}
                        />
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="col-span-12 md:col-span-6">
                  <div className="rounded-2xl border border-border/70 bg-background/20 p-4">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/80">
                      Rola
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-foreground/90">
                          {roleText}
                        </div>
                      </div>

                      {canChangeRole ? (
                        <AutoSubmitSelect
                          name="account_role"
                          defaultValue={roleSelectValue}
                          action={updateRoleAction}
                          hidden={{ memberId: member.id }}
                          className="rounded-xl border border-border/70 bg-background/30 px-3 py-2 text-xs font-semibold text-foreground/85 hover:bg-background/40"
                          options={[
                            { value: "owner", label: "Właściciel" },
                            { value: "manager", label: "Manager" },
                            { value: "foreman", label: "Brygadzista" },
                            { value: "storeman", label: "Magazynier" },
                            { value: "worker", label: "Pracownik" },
                          ]}
                          toast={{
                            okTitle: "Rola zaktualizowana",
                            errTitle: "Nie udało się zmienić roli",
                          }}
                        />
                      ) : null}
                    </div>
                  </div>
                </div>

                {canEditDetails ? (
                  <div className="col-span-12">
                    <div className="rounded-2xl border border-border/70 bg-background/20 p-4">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/80">
                        Dane kontaktowe
                      </div>

                      <form action={updateDetailsAction} className="mt-3 grid grid-cols-12 gap-2">
                        <input type="hidden" name="memberId" value={member.id} />

                        <div className="col-span-12 md:col-span-6">
                          <label className="block space-y-1">
                            <div className="text-[11px] text-muted-foreground">Imię</div>
                            <input
                              name="first_name"
                              defaultValue={member.first_name ?? ""}
                              className="w-full rounded-xl border border-border/70 bg-background/30 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/15"
                            />
                          </label>
                        </div>

                        <div className="col-span-12 md:col-span-6">
                          <label className="block space-y-1">
                            <div className="text-[11px] text-muted-foreground">Nazwisko</div>
                            <input
                              name="last_name"
                              defaultValue={member.last_name ?? ""}
                              className="w-full rounded-xl border border-border/70 bg-background/30 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/15"
                            />
                          </label>
                        </div>

                        <div className="col-span-12 md:col-span-6">
                          <label className="block space-y-1">
                            <div className="text-[11px] text-muted-foreground">E-mail</div>
                            <input
                              name="email"
                              type="email"
                              defaultValue={member.email ?? ""}
                              className="w-full rounded-xl border border-border/70 bg-background/30 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/15"
                            />
                          </label>
                        </div>

                        <div className="col-span-12 md:col-span-6">
                          <label className="block space-y-1">
                            <div className="text-[11px] text-muted-foreground">Telefon</div>
                            <input
                              name="phone"
                              defaultValue={member.phone ?? ""}
                              className="w-full rounded-xl border border-border/70 bg-background/30 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/15"
                            />
                          </label>
                        </div>

                        <div className="col-span-12 flex justify-end pt-1">
                          <button
                            type="submit"
                            className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/14"
                            formAction={updateDetailsAction}
                          >
                            Zapisz
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Actions (dla uprawnionych) */}
      {(canInvite || canRemove || canForceReset) ? (
        <div className="rounded-2xl border border-border/70 bg-card/60 p-4">
          <div className="text-sm font-semibold text-foreground">Akcje</div>

          <div className="mt-3 flex flex-wrap gap-2">
            {canInvite && member.status === "invited" ? (
              <form action={resendInviteAction}>
                <input type="hidden" name="memberId" value={member.id} />
                <button
                  type="submit"
                  className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-500/14"
                >
                  Wyślij ponownie
                </button>
              </form>
            ) : null}

            {canForceReset ? (
              <ForcePasswordResetButton memberId={member.id} email={member.email ?? ""} />
            ) : null}

            {canRemove ? (
              <form action={deleteMemberAction}>
                <input type="hidden" name="memberId" value={member.id} />
                <button
                  type="submit"
                  className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-500/14"
                >
                  Usuń
                </button>
              </form>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}