"use client";

import type { ReactNode } from "react";
import Sidebar from "@/components/Sidebar";
import UserMenu from "@/components/UserMenu";
import { usePermissionSnapshot } from "@/lib/RoleContext";

export default function AppShell({ children }: { children: ReactNode }) {
  const snapshot = usePermissionSnapshot();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="hidden md:block fixed left-0 top-0 bottom-0 w-72 border-r border-border/70 bg-background/30 backdrop-blur">
        <div className="h-full">
          <Sidebar />
        </div>
      </aside>

      {/* Main area */}
      <div className="md:pl-72">
        {/* Top bar */}
        <div className="sticky top-0 z-30 px-4 py-3 border-b border-border/70 bg-background/40 backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            
            {/* Rola użytkownika */}
            <div className="text-xs text-muted-foreground">
              Rola:
              <span className="ml-2 inline-flex items-center rounded-full border border-border bg-background/40 px-2 py-0.5 text-[11px] text-foreground/80">
                {snapshot?.role ?? "—"}
              </span>
            </div>

            {/* Menu użytkownika */}
            <UserMenu
             fullName="Twoje konto"
              roleLabel={snapshot?.role ?? "—"}
            />

          </div>
        </div>

        {/* Content */}
        <main className="px-4 py-6">{children}</main>
      </div>
    </div>
  );
}
