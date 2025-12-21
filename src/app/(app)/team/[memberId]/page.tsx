// src/app/(app)/team/[memberId]/page.tsx
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabaseServer";
import { PERM, can, canAny, type PermissionSnapshot } from "@/lib/permissions";
import ForcePasswordResetButton from "@/components/team/ForcePasswordResetButton";
import AutoSubmitSelect from "@/components/team/AutoSubmitSelect";

// ---------- PERMISSIONS SNAPSHOT ----------
async function fetchMyPermissionsSnapshot(): Promise<PermissionSnapshot | null> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("my_permissions_snapshot");

  if (error) {
    console.error("my_permissions_snapshot error:", error);
    return null;
  }

  const snap = Array.isArray(data) ? (data[0] ?? null) : (data ?? null);
  return (snap as PermissionSnapshot | null) ?? null;
}

function deny(msg = "Brak uprawnień."): never {
  throw new Error(msg);
}

function requirePerm(snapshot: PermissionSnapshot | null, key: any, msg?: string) {
  if (!can(snapshot, key)) deny(msg ?? "Brak uprawnień.");
}

// ---------- UI helpers ----------
const SEL = {
  none: "__none__",
} as const;

function InfoTile({
  label,
  value,
  right,
  className = "",
}: {
  label: string;
  value: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "min-w-0 rounded-xl border border-border/70 bg-background/40 px-3 py-2",
        "flex items-center justify-between gap-3",
        className,
      ].join(" ")}
    >
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/80">
          {label}
        </div>
        <div className="mt-0.5 truncate text-sm font-medium text-foreground/90">
          {value}
        </div>
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

const statusLabel = {
  invited: "Zaproszony",
  active: "Aktywny",
  disabled: "Zablokowany",
} as const;

const statusClass = {
  invited: "bg-amber-500/10 text-amber-300 border border-amber-500/40",
  active: "bg-emerald-500/10 text-emerald-300 border border-emerald-500/40",
  disabled: "bg-slate-500/10 text-slate-300 border border-slate-500/40",
} as const;

const roleLabel = {
  owner: "Właściciel",
  manager: "Manager",
  foreman: "Brygadzista",
  storeman: "Magazynier",
  worker: "Pracownik",
} as const;

// ---------- SERVER ACTIONS ----------
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
    throw new Error("Nie udało się wygenerować nowego zaproszenia.");
  }
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
    throw new Error("Nie udało się usunąć członka zespołu.");
  }

  redirect("/team");
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
    throw new Error("Nie udało się zmienić brygady.");
  }
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
    throw new Error("Nieprawidłowa rola.");
  }

  const { error } = await supabase.rpc("set_member_role", {
    p_member_id: memberId,
    p_role: role,
  });

  if (error) {
    console.error("set_member_role error:", error);
    throw new Error("Nie udało się zmienić roli.");
  }
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

  // dane kontaktowe u Ciebie idą pod TEAM_MANAGE_ROLES
  requirePerm(snapshot, PERM.TEAM_MANAGE_ROLES, "Brak uprawnień do edycji danych członka zespołu.");

  const { error } = await supabase
    .from("team_members")
    .update({ first_name, last_name, email, phone })
    .eq("id", memberId);

  if (error) {
    console.error("team_members update details error:", error);
    throw new Error("Nie udało się zapisać zmian.");
  }
}

// ---------- PAGE ----------
type PageProps = {
  params: Promise<{ memberId: string }>;
};

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
    <section className="flex flex-col gap-6">
      {/* Breadcrumb + header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="text-xs text-muted-foreground">
            <Link href="/team" className="hover:text-foreground hover:underline">
              Zespół
            </Link>{" "}
            / <span className="text-foreground">Szczegóły członka</span>
          </div>

          <h1 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">
            {fullName}
          </h1>

          {member.email ? <p className="text-sm text-muted-foreground">{member.email}</p> : null}
        </div>

        <div className="flex flex-col items-end gap-2 text-xs">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${
              statusClass[member.status]
            }`}
          >
            {statusLabel[member.status]}
          </span>

          <span className="inline-flex items-center rounded-full border border-border/70 bg-background/50 px-2.5 py-1 text-[11px] text-foreground/80">
            {roleText}
          </span>
        </div>
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-border/70 bg-card/60 p-4 shadow-sm">
        <div className="text-sm font-semibold text-foreground">Informacje</div>
        <div className="mt-1 text-xs text-muted-foreground">
          Zmiany są ograniczone uprawnieniami: brygadzista zmienia brygadę i może resetować hasło;
          manager/właściciel zarządza całością.
        </div>

        {/* Tiles */}
        <div className="mt-4 grid grid-cols-12 gap-2">
          <div className="col-span-12 md:col-span-6">
            <InfoTile label="E-mail" value={member.email ?? "—"} />
          </div>

          <div className="col-span-12 md:col-span-6">
            <InfoTile label="Telefon" value={member.phone ?? "—"} />
          </div>

          <div className="col-span-12 md:col-span-6">
            <InfoTile
              label="Brygada"
              value={crewText}
              right={
                canChangeCrew ? (
                  <AutoSubmitSelect
                    name="crew_id"
                    defaultValue={crewSelectValue}
                    action={updateCrewAction}
                    hidden={{ memberId: member.id }}
                    className="bg-transparent text-[11px] text-muted-foreground outline-none cursor-pointer"
                    options={[
                      { value: SEL.none, label: "—" },
                      ...crews.map((c) => ({ value: c.id, label: c.name })),
                    ]}
                  />
                ) : null
              }
            />
          </div>

          <div className="col-span-12 md:col-span-6">
            <InfoTile
              label="Rola"
              value={roleText}
              right={
                canChangeRole ? (
                  <AutoSubmitSelect
                    name="account_role"
                    defaultValue={roleSelectValue}
                    action={updateRoleAction}
                    hidden={{ memberId: member.id }}
                    className="bg-transparent text-[11px] text-muted-foreground outline-none cursor-pointer"
                    options={[
                      { value: "owner", label: "Właściciel" },
                      { value: "manager", label: "Manager" },
                      { value: "foreman", label: "Brygadzista" },
                      { value: "storeman", label: "Magazynier" },
                      { value: "worker", label: "Pracownik" },
                    ]}
                  />
                ) : null
              }
            />
          </div>
        </div>

        {/* Edit details (manager/owner) */}
        {canEditDetails ? (
          <div className="mt-4 rounded-2xl border border-border/70 bg-background/30 p-4">
            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground/80">
              Edycja danych
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Zmiana danych kontaktowych jest dostępna tylko dla Managera/Właściciela.
            </div>

            <form action={updateDetailsAction} className="mt-3 grid grid-cols-12 gap-2">
              <input type="hidden" name="memberId" value={member.id} />

              <div className="col-span-12 md:col-span-6">
                <label className="block space-y-1">
                  <div className="text-[11px] text-muted-foreground">Imię</div>
                  <input
                    name="first_name"
                    defaultValue={member.first_name ?? ""}
                    className="w-full rounded-xl border border-border/70 bg-background/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/15"
                  />
                </label>
              </div>

              <div className="col-span-12 md:col-span-6">
                <label className="block space-y-1">
                  <div className="text-[11px] text-muted-foreground">Nazwisko</div>
                  <input
                    name="last_name"
                    defaultValue={member.last_name ?? ""}
                    className="w-full rounded-xl border border-border/70 bg-background/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/15"
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
                    className="w-full rounded-xl border border-border/70 bg-background/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/15"
                  />
                </label>
              </div>

              <div className="col-span-12 md:col-span-6">
                <label className="block space-y-1">
                  <div className="text-[11px] text-muted-foreground">Telefon</div>
                  <input
                    name="phone"
                    defaultValue={member.phone ?? ""}
                    className="w-full rounded-xl border border-border/70 bg-background/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/15"
                  />
                </label>
              </div>

              <div className="col-span-12 flex justify-end pt-1">
                <button
                  type="submit"
                  className="rounded-xl border border-border/70 bg-foreground/15 px-3 py-2 text-xs font-semibold hover:bg-foreground/20"
                >
                  Zapisz zmiany
                </button>
              </div>
            </form>
          </div>
        ) : null}
      </div>

      {/* Actions */}
      {canInvite || canRemove || canForceReset ? (
        <div className="rounded-2xl border border-border/70 bg-card/60 p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground">Akcje</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Operacje wrażliwe są dodatkowo weryfikowane przez backend.
          </p>

          <div className="mt-4 flex flex-wrap items-start gap-3 text-sm">
            {canInvite && member.status === "invited" ? (
              <form action={resendInviteAction}>
                <input type="hidden" name="memberId" value={member.id} />
                <button
                  type="submit"
                  className="rounded-xl border border-border/70 bg-background/40 px-3 py-2 text-xs hover:bg-background/60"
                >
                  Wyślij ponownie zaproszenie
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
                  className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200 hover:bg-rose-500/15"
                >
                  Usuń członka zespołu
                </button>
              </form>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
