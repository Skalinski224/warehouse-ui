import type { ReactNode } from 'react';
import Sidebar from '@/components/Sidebar';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* LEWY PANEL */}
      <aside className="hidden md:block w-64 shrink-0 bg-card/70 border-r border-border backdrop-blur-sm shadow-inner">
        <Sidebar />
      </aside>

      {/* PRAWA CZĘŚĆ */}
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
