// src/components/MobileNavDrawer.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import Link from "next/link";

import Sidebar from "@/components/Sidebar";
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
  const pathname = usePathname();

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const drawer =
    mounted && open
      ? createPortal(
          <div className="fixed inset-0 z-[9999] lg:hidden">
            <div
              className="absolute inset-0 bg-black/55 backdrop-blur-sm"
              role="button"
              tabIndex={0}
              aria-label="Zamknij menu"
              onClick={() => setOpen(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") setOpen(false);
              }}
            />

            <div
              ref={panelRef}
              className={cx(
                "absolute left-0 top-0 h-full w-[66vw] max-w-[360px] md:w-[360px]",
                "border-r border-border bg-card/90 shadow-2xl"
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {/* ✅ header drawer'a: kafelek VERENA + X (bez napisu MENU) */}
              <div className="flex items-center justify-between gap-2 p-3 border-b border-border">
                <Link
                  href="/"
                  onClick={() => setOpen(false)}
                  className={cx(
                    "block flex-1 px-3 py-2 rounded-2xl border transition",
                    "bg-background/20 border-border/60 text-foreground/85 hover:bg-background/35"
                  )}
                >
                  <div className="text-sm font-semibold tracking-tight">VERENA</div>
                  <div className="text-[11px] text-foreground/55">Panel aplikacji</div>
                </Link>

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

              <div className={cx("h-[calc(100%-56px)] overflow-y-auto", "pb-[calc(env(safe-area-inset-bottom)+24px)]")}>
                <Sidebar onNavigate={() => setOpen(false)} />

                <div className="mt-4 border-t border-border p-3">
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
          </div>,
          document.body
        )
      : null;

  return (
    <>
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

      {drawer}
    </>
  );
}