// src/app/(app)/team/[memberId]/page.tsx

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabaseServer";
import RoleGuard from "@/components/RoleGuard";

// ---------- SERVER ACTIONS ----------

async function resendInviteAction(formData: FormData) {
  "use server";

  const memberId = formData.get("memberId") as string | null;
  if (!memberId) return;

  const supabase = await supabaseServer();

  const { error } = await supabase.rpc("rotate_invite_token", {
    p_member_id: memberId,
  });

  if (error) {
    console.error("rotate_invite_token error:", error);
    throw new Error("Nie udało się wygenerować nowego zaproszenia.");
  }

  // TODO: wysyłka maila przez Resend.
}

async function forceResetPasswordAction(formData: FormData) {
  "use server";

  const memberId = formData.get("memberId") as string | null;
  if (!memberId) return;

  // Placeholder – docelowo Supabase Admin API + mail z linkiem resetu.
  console.log("forceResetPasswordAction for member:", memberId);
}

async function deleteMemberAction(formData: FormData) {
  "use server";

  const memberId = formData.get("memberId") as string | null;
  if (!memberId) return;

  const supabase = await supabaseServer();

  const { error } = await supabase.rpc("delete_team_member", {
    p_member_id: memberId,
  });

  if (error) {
    console.error("delete_team_member error:", error);
    throw new Error("Nie udało się usunąć członka zespołu.");
  }

  redirect("/team");
}

// ---------- PAGE ----------

type PageProps = {
  params: Promise<{ memberId: string }>;
};

export default async function TeamMemberDetailPage(props: PageProps) {
  // ⬇ nowy sposób Next 15 – params jest Promisem
  const { memberId } = await props.params;

  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from("v_team_members_view")
    .select("*")
    .eq("id", memberId)
    .maybeSingle();

  if (error) {
    console.error("v_team_members_view error:", error);
    notFound();
  }

  if (!data) {
    notFound();
  }

  const member = data as {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    status: "invited" | "active" | "disabled";
    created_at: string | null;
    crew_name: string | null;
    account_role: "owner" | "manager" | "storeman" | "worker";
  };

  const fullName =
    [member.first_name, member.last_name].filter(Boolean).join(" ") ||
    member.email ||
    "Członek zespołu";

  const statusLabel: Record<typeof member.status, string> = {
    invited: "Zaproszony",
    active: "Aktywny",
    disabled: "Zablokowany",
  };

  const roleLabel: Record<typeof member.account_role, string> = {
    owner: "Właściciel",
    manager: "Manager",
    storeman: "Magazynier",
    worker: "Pracownik",
  };

  return (
    <RoleGuard allow={["owner", "manager", "storeman", "worker"]}>
      <section className="flex flex-col gap-6">
        {/* Górny pasek */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <div className="text-xs text-muted-foreground">
              <Link
                href="/team"
                className="hover:text-foreground hover:underline"
              >
                Zespół
              </Link>{" "}
              / <span className="text-foreground">Szczegóły członka</span>
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">
              {fullName}
            </h1>
            {member.email && (
              <p className="text-sm text-muted-foreground">{member.email}</p>
            )}
          </div>

          <div className="flex flex-col items-end gap-2 text-xs">
            <span className="inline-flex items-center rounded-full border border-border/70 bg-background/70 px-3 py-1">
              Rola:{" "}
              <span className="ml-1 font-medium">
                {roleLabel[member.account_role]}
              </span>
            </span>
            <span className="inline-flex items-center rounded-full border border-border/70 bg-background/70 px-3 py-1">
              Status:{" "}
              <span className="ml-1 font-medium">
                {statusLabel[member.status]}
              </span>
            </span>
          </div>
        </div>

        {/* Dane podstawowe */}
        <div className="grid gap-4 rounded-2xl border border-border/70 bg-card/60 p-4 text-sm shadow-sm md:grid-cols-2">
          <div className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Dane kontaktowe
            </h2>
            <div className="flex flex-col gap-1 text-xs">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Imię</span>
                <span className="font-medium text-foreground">
                  {member.first_name || "—"}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Nazwisko</span>
                <span className="font-medium text-foreground">
                  {member.last_name || "—"}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">E-mail</span>
                <span className="font-medium text-foreground">
                  {member.email || "—"}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Telefon</span>
                <span className="font-medium text-foreground">
                  {member.phone || "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Organizacja
            </h2>
            <div className="flex flex-col gap-1 text-xs">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Brygada</span>
                <span className="font-medium text-foreground">
                  {member.crew_name || "Brak brygady"}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Rola w koncie</span>
                <span className="font-medium text-foreground">
                  {roleLabel[member.account_role]}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium text-foreground">
                  {statusLabel[member.status]}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Akcje */}
        <div className="rounded-2xl border border-border/70 bg-card/60 p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground">
            Akcje dla członka zespołu
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Operacje wrażliwe są dodatkowo weryfikowane przez backend
            (uprawnienia, ostatni właściciel itd.).
          </p>

          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            {/* Wyślij ponownie zaproszenie */}
            {member.status === "invited" && (
              <form action={resendInviteAction}>
                <input type="hidden" name="memberId" value={member.id} />
                <button
                  type="submit"
                  className="rounded-full border border-border px-3 py-1.5 hover:bg-muted/60"
                >
                  Wyślij ponownie zaproszenie
                </button>
              </form>
            )}

            {/* Wymuś reset hasła */}
            <form action={forceResetPasswordAction}>
              <input type="hidden" name="memberId" value={member.id} />
              <button
                type="submit"
                className="rounded-full border border-border px-3 py-1.5 hover:bg-muted/60"
              >
                Wymuś reset hasła
              </button>
            </form>

            {/* Usuń */}
            <form action={deleteMemberAction}>
              <input type="hidden" name="memberId" value={member.id} />
              <button
                type="submit"
                className="rounded-full border border-destructive/60 px-3 py-1.5 text-destructive hover:bg-destructive/10"
              >
                Usuń członka zespołu
              </button>
            </form>
          </div>
        </div>
      </section>
    </RoleGuard>
  );
}
