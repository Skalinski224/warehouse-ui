// src/components/AppShell.tsx
"use client";

import type { ReactNode } from "react";
import Sidebar from "@/components/Sidebar";
import UserMenu from "@/components/UserMenu";

import { useAccountRole } from "@/lib/RoleContext";

/**
 * AppShell – ogólna "rama" aplikacji:
 * - lewy sidebar
 * - górny pasek z UserMenu
 * - miejsce na children (content)
 *
 * Może pokazywać/ukrywać elementy zależnie od roli użytkownika.
 * Używane głównie w client components 🙂
 */
export default function AppShell({ children }: { children: ReactNode }) {
  const role = useAccountRole();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* LEWY PANEL */}
      <aside className="hidden md:block fixed left-0 top-0 bottom-0 w-64 z-40 bg-card/80 border-r border-border shadow-inner">
        <div className="h-full overflow-y-auto">
          <Sidebar />
        </div>
      </aside>

      {/* PRAWA KOLUMNA */}
      <div className="md:pl-64">
        <div className="sticky top-0 z-30 flex items-center justify-end gap-3 px-4 md:px-6 py-3 border-b border-border bg-background/80 backdrop-blur">
          <UserMenu name="Twoje konto" role={role} />
        </div>

        {/* TREŚĆ */}
        <main className="px-4 md:px-6 pb-14 md:pb-10 pt-6">{children}</main>
      </div>
    </div>
  );
}
