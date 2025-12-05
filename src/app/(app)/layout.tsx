// src/app/(app)/layout.tsx

import type { ReactNode } from "react";

import Sidebar from "@/components/Sidebar";
import UserMenu from "@/components/UserMenu";

import { getCurrentUserInfo } from "@/lib/currentUser";
import { getCurrentRole, type AccountRole } from "@/lib/getCurrentRole";
import { RoleProvider } from "@/lib/RoleContext";

export default async function AppLayout({ children }: { children: ReactNode }) {
  // pobranie użytkownika (Twoje istniejące API)
  const me = await getCurrentUserInfo();

  // pobranie roli z Supabase → role_in_account()
  const roleFromRpc = await getCurrentRole();

  // „efektywna” rola: najpierw RPC, potem pole z users, na końcu null
  const effectiveRole: AccountRole | null =
    (roleFromRpc as AccountRole | null) ??
    ((me?.role as AccountRole | null) ?? null);

  return (
    <RoleProvider value={effectiveRole}>
      <div className="min-h-screen bg-background text-foreground">
        {/* LEWY PANEL */}
        <aside className="hidden md:block fixed left-0 top-0 bottom-0 w-64 z-40 bg-card/80 border-r border-border shadow-inner">
          <div className="h-full overflow-y-auto">
            {/* Sidebar może pobierać role przez useAccountRole() */}
            <Sidebar />
          </div>
        </aside>

        {/* PRAWA KOLUMNA */}
        <div className="md:pl-64">
          <div className="sticky top-0 z-30 flex items-center justify-end gap-3 px-4 md:px-6 py-3 border-b border-border bg-background/80 backdrop-blur">
            {me ? (
              <UserMenu
                name={me.name}
                role={
                  effectiveRole ??
                  ((me.role as AccountRole | null) ?? null)
                }
              />
            ) : null}
          </div>

          <main className="px-4 md:px-6 pb-14 md:pb-10 pt-6">
            {children}
          </main>
        </div>
      </div>
    </RoleProvider>
  );
}
