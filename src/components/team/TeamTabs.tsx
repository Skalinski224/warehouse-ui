// src/components/team/TeamTabs.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function TeamTabs() {
  const pathname = usePathname();
  const isTeam = pathname === "/team" || pathname === "/team/";

  const baseTabClasses =
    "rounded-xl px-3 py-1.5 text-[11px] font-medium tracking-wide transition-colors";
  const activeClasses = "bg-primary text-primary-foreground";
  const inactiveClasses = "text-muted-foreground hover:bg-muted/60";

  return (
    <div className="flex justify-center">
      <div className="inline-flex items-center gap-2 rounded-2xl border border-border/70 bg-card/60 p-1 text-xs shadow-sm">
        <Link
          href="/team"
          className={`${baseTabClasses} ${isTeam ? activeClasses : inactiveClasses}`}
        >
          Zespół
        </Link>
      </div>
    </div>
  );
}

export default TeamTabs;