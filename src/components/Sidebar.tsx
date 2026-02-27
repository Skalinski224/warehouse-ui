// src/app/(app)/components/Sidebar.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { usePermissionSnapshot } from "@/lib/RoleContext";
import { PERM, can, type PermissionKey } from "@/lib/permissions";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */
type NavItem = {
  href: string;
  label: string;
  perm: PermissionKey;
};

type Section = {
  title: string;
  items: NavItem[];
  collapsible?: boolean; // "Rozszerzenia"
  defaultOpen?: boolean;
};

const APP_NAME = "VERENA";

/* ------------------------------------------------------------------ */
/* Items (kanoniczne)                                                  */
/* ------------------------------------------------------------------ */
const ALL_ITEMS = {
  summary: { href: "/summary", label: "Podsumowanie", perm: PERM.METRICS_READ as PermissionKey },

  team: { href: "/team", label: "Zespół", perm: PERM.TEAM_READ as PermissionKey },
  crews: { href: "/team/crews", label: "Brygady", perm: PERM.CREWS_READ as PermissionKey },

  reports: { href: "/reports", label: "Raporty", perm: PERM.REPORTS_ITEMS_READ as PermissionKey },

  lowStock: { href: "/low-stock", label: "Co się kończy", perm: PERM.LOW_STOCK_READ as PermissionKey },

  materials: { href: "/materials", label: "Katalog materiałów", perm: PERM.MATERIALS_READ as PermissionKey },
  dailyReports: { href: "/daily-reports", label: "Dzienne zużycie", perm: PERM.DAILY_REPORTS_READ as PermissionKey },
  deliveries: { href: "/deliveries", label: "Dostawy", perm: PERM.DELIVERIES_READ as PermissionKey },
  inventory: { href: "/inventory", label: "Inwentaryzacja", perm: PERM.INVENTORY_READ as PermissionKey },

  myTasks: { href: "/tasks", label: "Zadania", perm: PERM.TASKS_READ_OWN as PermissionKey },
  object: { href: "/object", label: "Obiekt i struktura", perm: PERM.PROJECT_MANAGE as PermissionKey },
} satisfies Record<string, NavItem>;

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */
function buildSections(): Section[] {
  return [
    {
      title: "ZARZĄDZANIE",
      items: [ALL_ITEMS.summary, ALL_ITEMS.team, ALL_ITEMS.reports, ALL_ITEMS.lowStock],
    },
    {
      title: "MAGAZYN",
      items: [ALL_ITEMS.materials, ALL_ITEMS.dailyReports, ALL_ITEMS.deliveries, ALL_ITEMS.inventory],
    },
    {
      title: "ROZSZERZENIA",
      items: [ALL_ITEMS.crews, ALL_ITEMS.myTasks, ALL_ITEMS.object],
      collapsible: true,
      defaultOpen: false,
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

function SectionHeader({
  title,
  collapsible,
  open,
  onToggle,
}: {
  title: string;
  collapsible?: boolean;
  open?: boolean;
  onToggle?: () => void;
}) {
  if (!collapsible) {
    return (
      <div className="px-3 py-2 rounded-2xl bg-background/20 border border-border/60">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-foreground/70">{title}</div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open ? "true" : "false"}
      className={cx(
        "w-full px-3 py-3 rounded-2xl border border-border/60",
        "bg-background/20 hover:bg-background/30 transition",
        "flex items-center justify-between gap-3",
        "text-left"
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cx(
            "inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border/60",
            "bg-background/20"
          )}
          aria-hidden="true"
        >
          {open ? "−" : "+"}
        </span>
        <div className="text-sm font-semibold text-foreground">{title}</div>
      </div>

      <span
        className={cx(
          "text-[11px] px-2 py-1 rounded-xl border border-border/60",
          "bg-background/10 text-foreground/75"
        )}
      >
        {open ? "zwiń" : "rozwiń"}
      </span>
    </button>
  );
}

function YellowBang() {
  return (
    <span
      className={cx(
        "ml-2 inline-flex h-6 min-w-[24px] items-center justify-center rounded-full px-1.5",
        "border border-yellow-500/50 bg-yellow-500/20 text-yellow-300",
        "text-xs font-black leading-none shadow-sm"
      )}
      aria-label="Nowe pozycje"
      title="Nowe pozycje"
    >
      !
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */
export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const snapshot = usePermissionSnapshot();

  const [extensionsOpen, setExtensionsOpen] = useState(false);

  // wspólny badge dla "Co się kończy": low_stock + faktury
  const [alertsNewCount, setAlertsNewCount] = useState<number>(0);

  useEffect(() => {
    const s = buildSections().find((x) => x.title === "ROZSZERZENIA");
    setExtensionsOpen(Boolean(s?.defaultOpen));
  }, []);

  const sections = useMemo(() => buildSections(), []);
  if (!snapshot) return null;

  const canSeeLowStock = can(snapshot, PERM.LOW_STOCK_READ as PermissionKey);

  // ✅ lock żeby nie robić wielu fetchy na raz (eventy potrafią strzelać seriami)
  const busyRef = useRef(false);

  async function refreshAlertsBadge() {
    if (!canSeeLowStock) return;
    if (busyRef.current) return;

    busyRef.current = true;
    try {
      const res = await fetch("/api/alerts/badge", { cache: "no-store" });
      const j = await res.json();
      const n = typeof j?.count === "number" ? j.count : Number(j?.count ?? 0);
      setAlertsNewCount(Number.isFinite(n) ? n : 0);
    } catch {
      setAlertsNewCount(0);
    } finally {
      busyRef.current = false;
    }
  }

  // ✅ TYLKO: start + event (bez pathname i bez polling)
  useEffect(() => {
    refreshAlertsBadge();

    function onRefresh() {
      refreshAlertsBadge();
    }

    window.addEventListener("alerts:refresh", onRefresh);
    return () => window.removeEventListener("alerts:refresh", onRefresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSeeLowStock]);

  return (
    <nav className="p-3 space-y-4">
      <Link
        href="/"
        onClick={onNavigate}
        className={cx(
          "hidden lg:block px-3 py-2 rounded-2xl border transition",
          isActive(pathname, "/")
            ? "bg-background border-border text-foreground"
            : "bg-background/20 border-border/60 text-foreground/85 hover:bg-background/35"
        )}
      >
        <div className="text-sm font-semibold tracking-tight">{APP_NAME}</div>
        <div className="text-[11px] text-foreground/55">Panel aplikacji</div>
      </Link>

      {sections.map((section) => {
        const visible = section.items.filter((i) => can(snapshot, i.perm));
        if (visible.length === 0) return null;

        const isExtensions = section.title === "ROZSZERZENIA";
        const open = isExtensions ? extensionsOpen : true;

        return (
          <div key={section.title} className="space-y-2">
            <SectionHeader
              title={section.title === "ROZSZERZENIA" ? "Rozszerzenia" : section.title}
              collapsible={Boolean(section.collapsible)}
              open={open}
              onToggle={isExtensions ? () => setExtensionsOpen((v) => !v) : undefined}
            />

            {open && (
              <ul className="space-y-1">
                {visible.map((it) => {
                  const active = isActive(pathname, it.href);

                  // ✅ JEDEN badge tylko przy "Co się kończy"
                  const showBang = it.href === "/low-stock" && alertsNewCount > 0;

                  return (
                    <li key={it.href}>
                      <Link
                        href={it.href}
                        onClick={onNavigate}
                        className={cx(
                          "group flex items-center gap-2 px-3 py-2 rounded-2xl text-sm transition border",
                          active
                            ? "bg-background border-border text-foreground"
                            : "bg-transparent border-transparent text-foreground/75 hover:bg-background/25 hover:border-border/50"
                        )}
                      >
                        <span
                          className={cx(
                            "h-2 w-2 rounded-full",
                            active ? "bg-foreground" : "bg-foreground/25 group-hover:bg-foreground/35"
                          )}
                        />

                        <span className={cx(active ? "font-semibold" : "font-medium", "flex items-center")}>
                          {it.label}
                          {showBang ? <YellowBang /> : null}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}