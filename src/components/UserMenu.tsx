// src/components/UserMenu.tsx
"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { signOut } from "@/app/actions/signout";
import { usePermissionSnapshot } from "@/lib/RoleContext";
import { PERM, can } from "@/lib/permissions";

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

type Props = {
  fullName: string;
  roleLabel: string;
  crewName?: string | null;
};

function toPlRoleLabel(roleLabel: string): string {
  const raw = String(roleLabel ?? "").trim();
  const key = raw.toLowerCase();

  const map: Record<string, string> = {
    owner: "Właściciel",
    manager: "Kierownik",
    project_manager: "Kierownik projektu",
    storeman: "Magazynier",
    worker: "Pracownik",
    foreman: "Brygadzista",
    forman: "Brygadzista", // na wypadek literówki w danych
  };

  return map[key] ?? (raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : "—");
}

export default function UserMenu({ fullName, roleLabel, crewName }: Props) {
  const snapshot = usePermissionSnapshot();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const rolePl = useMemo(() => toPlRoleLabel(roleLabel), [roleLabel]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cx(
          "inline-flex items-center gap-2 rounded-2xl border border-border px-3 py-2",
          "bg-background/10 hover:bg-background/20 transition",
          "focus:outline-none focus:ring-2 focus:ring-ring/40"
        )}
        aria-expanded={open}
      >
        <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500/80" />
        <div className="flex flex-col items-start leading-tight">
          <span className="text-sm font-semibold text-foreground">{fullName}</span>
          <span className="text-[11px] text-muted-foreground">
            {rolePl}
            {crewName ? ` • ${crewName}` : ""}
          </span>
        </div>
        <span className="ml-2 text-xs text-muted-foreground">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div
          className={cx(
            "absolute right-0 mt-2 w-64 rounded-2xl border border-border bg-card/90 p-2",
            "shadow-lg backdrop-blur",
            "z-50"
          )}
        >
          <div className="px-2 py-2">
            <div className="text-xs font-semibold text-foreground">{fullName}</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              rola: <span className="text-foreground/90">{rolePl}</span>
              {crewName ? (
                <>
                  {" "}
                  • brygada: <span className="text-foreground/90">{crewName}</span>
                </>
              ) : null}
            </div>
          </div>

          <div className="my-2 h-px bg-border/70" />

          {snapshot && can(snapshot, PERM.PROJECT_SETTINGS_MANAGE) && (
            <button
              className={cx(
                "w-full rounded-xl px-3 py-2 text-left text-sm transition border",
                "border-transparent hover:border-border/60 hover:bg-background/20"
              )}
              onClick={() => (window.location.href = "/settings")}
            >
              Ustawienia
            </button>
          )}

          <form action={signOut}>
            <button
              className={cx(
                "mt-1 w-full rounded-xl px-3 py-2 text-left text-sm transition border",
                "border-transparent hover:border-border/60 hover:bg-background/20",
                "text-red-400"
              )}
            >
              Wyloguj
            </button>
          </form>
        </div>
      )}
    </div>
  );
}