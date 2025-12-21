// src/components/AppShell.tsx
"use client";

import type { ReactNode } from "react";
import Sidebar from "@/components/Sidebar";
import UserMenu from "@/components/UserMenu";
import { usePermissionSnapshot } from "@/lib/RoleContext";

export default function AppShell({ children }: { children: ReactNode }) {
  const snapshot = usePermissionSnapshot();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="hidden md:block fixed left-0 top-0 bottom-0 w-72 border-r border-border/70 bg-background/30 backdrop-blur">
        <div className="h-full">
          <Sidebar />
        </div>
      </aside>

      <div className="md:pl-72">
        <div className="sticky top-0 z-30 px-4 py-3 border-b border-border/70 bg-background/40 backdrop-blur">
          <UserMenu name="Twoje konto" role={snapshot?.role ?? "—"} />
        </div>

        <main className="px-4 py-6">{children}</main>
      </div>
    </div>
  );
}
