import type { ReactNode } from "react";

import Sidebar from "@/components/Sidebar";
import UserMenu from "@/components/UserMenu";
import MobileNavDrawer from "@/components/MobileNavDrawer";

import { supabaseServer } from "@/lib/supabaseServer";
import { getPermissionSnapshot } from "@/lib/currentUser";
import { RoleProvider } from "@/lib/RoleContext";
import type { PermissionSnapshot } from "@/lib/permissions";

function roleLabelFromSnapshot(snap: PermissionSnapshot | null): string {
  if (!snap) return "—";
  const anySnap = snap as any;
  const maybe =
    anySnap.role_label ??
    anySnap.roleLabel ??
    anySnap.role ??
    anySnap.account_role ??
    anySnap.accountRole ??
    null;

  return typeof maybe === "string" && maybe.trim().length > 0 ? maybe : "—";
}

async function getTeamProfile(sb: any, userId: string) {
  // Minimalny, bezpieczny fetch:
  // 1) team_members po user_id
  // 2) (opcjonalnie) crews po crew_id
  try {
    const { data: tm, error: tmErr } = await sb
      .from("team_members")
      .select("first_name,last_name,crew_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (tmErr) return { fullName: null as string | null, crewName: null as string | null };

    const first = String(tm?.first_name ?? "").trim();
    const last = String(tm?.last_name ?? "").trim();
    const fullName = [first, last].filter(Boolean).join(" ") || null;

    let crewName: string | null = null;
    const crewId = tm?.crew_id ?? null;
    if (crewId) {
      const { data: crew, error: cErr } = await sb
        .from("crews")
        .select("name")
        .eq("id", crewId)
        .maybeSingle();
      if (!cErr) crewName = (crew?.name ?? null) as any;
    }

    return { fullName, crewName };
  } catch {
    return { fullName: null, crewName: null };
  }
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const permissions: PermissionSnapshot | null = await getPermissionSnapshot();

  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();

  const displayRole = roleLabelFromSnapshot(permissions);

  // fullName + crew z team_members/crews (fallback na user metadata/email)
  let fullName =
    (user?.user_metadata?.full_name as string | undefined) ??
    (user?.user_metadata?.name as string | undefined) ??
    "";
  let crewName: string | null = null;

  if (user?.id) {
    const prof = await getTeamProfile(sb, user.id);
    if (prof.fullName) fullName = prof.fullName;
    crewName = prof.crewName ?? null;
  }

  if (!fullName?.trim()) fullName = user?.email ?? "Użytkownik";

  return (
    <RoleProvider value={permissions}>
      <div className="min-h-screen bg-background text-foreground">
        {/* DESKTOP sidebar (tylko lg+) */}
        <aside className="hidden lg:block fixed left-0 top-0 bottom-0 w-64 z-40 bg-card/80 border-r border-border shadow-inner">
          <div className="h-full overflow-y-auto">
            <Sidebar />
          </div>
        </aside>

        {/* Right column */}
        <div className="lg:pl-64">
          <div className="sticky top-0 z-30 flex items-center justify-between gap-3 px-4 md:px-6 py-3 border-b border-border bg-background/80 backdrop-blur">
            {/* Left: hamburger (tablet/phone) */}
            <div className="flex items-center gap-2">
              <MobileNavDrawer fullName={fullName} roleLabel={displayRole} crewName={crewName} />
            </div>

            {/* Right: UserMenu widoczny na tablet+ (md+) i desktop */}
            <div className="hidden md:flex items-center gap-3">
              {user ? <UserMenu fullName={fullName} roleLabel={displayRole} crewName={crewName} /> : null}
            </div>
          </div>

          <main className="px-4 md:px-6 pb-14 md:pb-10 pt-6">{children}</main>
        </div>
      </div>
    </RoleProvider>
  );
}
