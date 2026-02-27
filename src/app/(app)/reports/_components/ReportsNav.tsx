// src/app/(app)/reports/_components/ReportsNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type Card = {
  href: string;
  title: string;
  desc?: string;
};

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function isActivePath(pathname: string, href: string) {
  if (!href) return false;
  if (href === "/reports") return pathname === "/reports";
  return pathname === href || pathname.startsWith(href + "/") || pathname.startsWith(href + "?");
}

function isExtensionCard(c: Card) {
  const t = (c.title ?? "").toLowerCase().trim();

  // ✅ chowamy te rzeczy pod "Rozszerzenia"
  if (t.includes("etap projektu")) return true;
  if (t.includes("zmiany w materiałach")) return true;

  // Dodatkowo: te z Twojego screena "Rozszerzenia"
  if (t.includes("brygady")) return true;
  if (t.includes("zadania")) return true;
  if (t.includes("obiekt") || t.includes("struktura")) return true;

  return false;
}

export default function ReportsNav({ visible }: { visible: Card[] }) {
  const pathname = usePathname();
  const [extOpen, setExtOpen] = useState(false);

  const { mainCards, extCards } = useMemo(() => {
    const main: Card[] = [];
    const ext: Card[] = [];
    (visible ?? []).forEach((c) => (isExtensionCard(c) ? ext.push(c) : main.push(c)));
    return { mainCards: main, extCards: ext };
  }, [visible]);

  // Mobile/tablet: poziome taby z przewijaniem + strzałki
  const stripRef = useRef<HTMLDivElement | null>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  function updateArrows() {
    const el = stripRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanLeft(scrollLeft > 2);
    setCanRight(scrollLeft + clientWidth < scrollWidth - 2);
  }

  function scrollByPx(px: number) {
    const el = stripRef.current;
    if (!el) return;
    el.scrollBy({ left: px, behavior: "smooth" });
  }

  function centerPill(target: HTMLElement) {
    const el = stripRef.current;
    if (!el) return;

    const elRect = el.getBoundingClientRect();
    const tRect = target.getBoundingClientRect();

    const elCenter = elRect.left + elRect.width / 2;
    const tCenter = tRect.left + tRect.width / 2;

    const delta = tCenter - elCenter;
    const next = el.scrollLeft + delta;

    el.scrollTo({ left: next, behavior: "smooth" });
  }

  function centerActivePill() {
    const el = stripRef.current;
    if (!el) return;

    // 1) jeśli jest aktywna — centruj aktywną
    const active = el.querySelector<HTMLElement>('[data-active="true"]');
    if (active) {
      centerPill(active);
      return;
    }

    // 2) fallback: zawsze centruj pierwszą (np. na /reports)
    const first = el.querySelector<HTMLElement>('[data-pill="true"]');
    if (first) centerPill(first);
  }

  useEffect(() => {
    updateArrows();
    const el = stripRef.current;
    if (!el) return;

    function onScroll() {
      updateArrows();
    }
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", updateArrows);

    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", updateArrows);
    };
  }, []);

  // domyślnie: jeśli jesteśmy w rozszerzeniach -> otwórz
  useEffect(() => {
    const inExt = extCards.some((c) => isActivePath(pathname, c.href));
    if (inExt) setExtOpen(true);
  }, [pathname, extCards]);

  // ✅ centruj: po wejściu (pierwsza w środku) i po każdej zmianie ścieżki
  useEffect(() => {
    const id1 = requestAnimationFrame(() => {
      const id2 = requestAnimationFrame(() => {
        centerActivePill();
        updateArrows();
      });
      return () => cancelAnimationFrame(id2);
    });

    return () => cancelAnimationFrame(id1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, mainCards.length, extCards.length, extOpen]);

  const navLinkBase =
    "rounded-xl border border-transparent px-3 py-2 transition hover:bg-background/40 hover:border-border";
  const navLinkActive = "bg-background/40 border-border ring-1 ring-foreground/20";

  const pillBase =
    "inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-2 text-sm transition";
  const pillIdle = "border-border bg-background/20 hover:bg-background/30";
  const pillActive = "border-foreground/30 bg-background/40 ring-1 ring-foreground/20";

  return (
    <>
      {/* ✅ DESKTOP SIDEBAR (lg+) */}
      <aside className="hidden lg:block">
        <div className="rounded-2xl border border-border bg-card p-2 sticky top-4">
          {visible.length === 0 ? (
            <div className="p-3 text-sm text-foreground/70">Brak dostępu.</div>
          ) : (
            <nav className="grid gap-1">
              {/* main */}
              {mainCards.map((c) => {
                const active = isActivePath(pathname, c.href);
                return (
                  <Link
                    key={c.href}
                    href={c.href}
                    className={cls(navLinkBase, active && navLinkActive)}
                  >
                    <div className="text-sm font-medium">{c.title}</div>
                    {c.desc ? (
                      <div className="text-[11px] text-muted-foreground">{c.desc}</div>
                    ) : null}
                  </Link>
                );
              })}

              {/* extensions */}
              {extCards.length > 0 && (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => setExtOpen((v) => !v)}
                    className={cls(
                      "w-full rounded-2xl border border-border bg-background/10 px-3 py-2",
                      "hover:bg-background/20 transition flex items-center justify-between"
                    )}
                    aria-expanded={extOpen}
                  >
                    <span className="text-sm font-medium">Rozszerzenia</span>
                    <span className="text-xs opacity-70">{extOpen ? "zwiń" : "rozwiń"}</span>
                  </button>

                  <div className={cls("grid gap-1 mt-2 pl-2", !extOpen && "hidden")}>
                    {extCards.map((c) => {
                      const active = isActivePath(pathname, c.href);
                      return (
                        <Link
                          key={c.href}
                          href={c.href}
                          className={cls(navLinkBase, active && navLinkActive)}
                        >
                          <div className="text-sm font-medium">{c.title}</div>
                          {c.desc ? (
                            <div className="text-[11px] text-muted-foreground">{c.desc}</div>
                          ) : null}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </nav>
          )}
        </div>
      </aside>

      {/* ✅ MOBILE/TABLET TOP PANEL (<lg) */}
      <div className="lg:hidden">
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          {/* tab strip */}
          <div className="relative border-b border-border bg-background/10">
            {/* arrows */}
            <button
              type="button"
              onClick={() => scrollByPx(-260)}
              className={cls(
                "absolute left-2 top-1/2 -translate-y-1/2 z-10",
                "h-9 w-9 rounded-full border border-border bg-background/70",
                "backdrop-blur hover:bg-background/90 transition",
                !canLeft && "opacity-0 pointer-events-none"
              )}
              aria-label="Przewiń w lewo"
            >
              ←
            </button>

            <button
              type="button"
              onClick={() => scrollByPx(260)}
              className={cls(
                "absolute right-2 top-1/2 -translate-y-1/2 z-10",
                "h-9 w-9 rounded-full border border-border bg-background/70",
                "backdrop-blur hover:bg-background/90 transition",
                !canRight && "opacity-0 pointer-events-none"
              )}
              aria-label="Przewiń w prawo"
            >
              →
            </button>

            <div
              ref={stripRef}
              className={cls(
                "flex gap-2 overflow-x-auto",
                // ✅ padding pod strzałki, żeby nie zasłaniały pilli
                "px-14 py-3",
                "scroll-smooth",
                "snap-x snap-mandatory",
                "max-w-full min-w-0"
              )}
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              {mainCards.map((c) => {
                const active = isActivePath(pathname, c.href);
                return (
                  <Link
                    key={c.href}
                    href={c.href}
                    data-pill="true"
                    data-active={active ? "true" : "false"}
                    className={cls(pillBase, "snap-start shrink-0", active ? pillActive : pillIdle)}
                  >
                    {c.title}
                  </Link>
                );
              })}

              {extCards.length > 0 && (
                <button
                  type="button"
                  onClick={() => setExtOpen((v) => !v)}
                  data-pill="true"
                  data-active={extOpen ? "true" : "false"}
                  className={cls(pillBase, "snap-start shrink-0", extOpen ? pillActive : pillIdle)}
                  aria-expanded={extOpen}
                >
                  Rozszerzenia <span className="opacity-70">{extOpen ? "—" : "+"}</span>
                </button>
              )}
            </div>
          </div>

          {/* extensions panel */}
          {extCards.length > 0 && (
            <div
              className={cls(
                "px-3",
                "transition-all duration-200 ease-out",
                extOpen ? "max-h-[420px] opacity-100 py-3" : "max-h-0 opacity-0 py-0 overflow-hidden"
              )}
            >
              <div className="rounded-2xl border border-border bg-background/10 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Rozszerzenia</div>
                  <button
                    type="button"
                    onClick={() => setExtOpen(false)}
                    className="text-xs opacity-70 hover:opacity-100 transition"
                  >
                    zwiń
                  </button>
                </div>

                <nav className="mt-2 grid gap-1">
                  {extCards.map((c) => {
                    const active = isActivePath(pathname, c.href);
                    return (
                      <Link
                        key={c.href}
                        href={c.href}
                        className={cls(
                          "rounded-xl px-3 py-2 border transition",
                          active
                            ? "border-foreground/25 bg-background/30 ring-1 ring-foreground/20"
                            : "border-transparent hover:border-border hover:bg-background/20"
                        )}
                        onClick={() => setExtOpen(false)}
                      >
                        <div className="text-sm font-medium">{c.title}</div>
                        {c.desc ? (
                          <div className="text-[11px] text-muted-foreground">{c.desc}</div>
                        ) : null}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}