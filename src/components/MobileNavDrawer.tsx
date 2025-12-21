"use client";

import { useEffect, useRef, useState } from "react";
import Sidebar from "@/components/Sidebar";
import UserMenu from "@/components/UserMenu";
import { signOut } from "@/app/actions/signout";

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

type Props = {
  fullName: string;
  roleLabel: string;
  crewName?: string | null;
};

export default function MobileNavDrawer({ fullName, roleLabel, crewName }: Props) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!open) return;
      const t = e.target as Node;
      if (panelRef.current && !panelRef.current.contains(t)) setOpen(false);
    }
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, [open]);

  return (
    <>
      {/* Hamburger (widoczny na tablet/telefon, znika na desktop) */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cx(
          "inline-flex items-center justify-center rounded-2xl border border-border",
          "bg-background/10 hover:bg-background/20 transition",
          "h-10 w-10",
          "lg:hidden"
        )}
        aria-label="Otwórz menu"
        title="Menu"
      >
        <span className="text-lg leading-none">☰</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm">
          <div
            ref={panelRef}
            className={cx(
              "absolute left-0 top-0 h-full w-[320px] max-w-[90vw]",
              "border-r border-border bg-card/90",
              "shadow-2xl"
            )}
          >
            <div className="flex items-center justify-between gap-2 p-3 border-b border-border">
              <div className="min-w-0">
                {/* Na telefonie UserMenu jest w drawerze */}
                <UserMenu fullName={fullName} roleLabel={roleLabel} crewName={crewName ?? null} />
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className={cx(
                  "inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border",
                  "bg-background/10 hover:bg-background/20 transition"
                )}
                aria-label="Zamknij menu"
                title="Zamknij"
              >
                ✕
              </button>
            </div>

            <div className="h-[calc(100%-56px)] flex flex-col">
              <div className="flex-1 overflow-y-auto">
                {/* Sidebar jako lista linków */}
                <Sidebar />
              </div>

              {/* Na samym dole: Wyloguj */}
              <div className="border-t border-border p-3">
                <form action={signOut}>
                  <button
                    className={cx(
                      "w-full rounded-2xl border border-border px-3 py-2.5 text-left text-sm font-semibold",
                      "bg-background/10 hover:bg-background/20 transition",
                      "text-red-400"
                    )}
                  >
                    Wyloguj
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
