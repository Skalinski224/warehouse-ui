"use client";

import { useState, useRef, useEffect } from "react";
import { signOut } from "@/app/actions/signout";
import type { MaybeRole } from "@/lib/RoleContext";

export default function UserMenu(props: { name: string; role: MaybeRole }) {
  const { name, role } = props;

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-3 rounded-xl border border-border bg-card/70 px-3 py-2 hover:bg-card shadow-sm"
      >
        <div className="size-8 rounded-full bg-background grid place-items-center text-xs border border-border">
          N
        </div>

        <div className="text-left leading-tight">
          <div className="text-sm font-medium">{name}</div>
          <div className="text-xs text-foreground/70">
            {role ?? "brak roli"}
          </div>
        </div>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl border border-border bg-card shadow-lg overflow-hidden">
          <button
            className="w-full text-left px-3 py-2 text-sm hover:bg-background/40"
            onClick={() => {
              setOpen(false);
              window.location.href = "/settings";
            }}
          >
            Ustawienia globalne
          </button>

          <div className="h-px bg-border/60" />

          <form action={signOut}>
            <button className="w-full text-left px-3 py-2 text-sm hover:bg-background/40 text-red-400">
              Wyloguj
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
