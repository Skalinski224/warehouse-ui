"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePermissionSnapshot } from "@/lib/RoleContext";
import { PERM, can, type PermissionKey } from "@/lib/permissions";
import { FLAGS } from "@/lib/flags";

type NavItem = {
  href: string;
  label: string;
  perm: PermissionKey;
};

type Section = {
  title?: string;
  items: NavItem[];
};

const APP_NAME = "Warehouse UI";

// kanoniczna lista
const ALL_ITEMS: {
  home: NavItem;
  myTasks: NavItem;
  analytics: NavItem;
  lowStock: NavItem;
  reports: NavItem;
  materials: NavItem;
  deliveries: NavItem;
  inventory: NavItem;
  dailyReports: NavItem;
  object: NavItem;
  team: NavItem;
} = {
  home: { href: "/", label: APP_NAME, perm: PERM.METRICS_READ },
  myTasks: { href: "/tasks", label: "Moje zadania", perm: PERM.TASKS_READ_OWN },
  analytics: { href: "/analyze/metrics", label: "Analizy", perm: PERM.METRICS_READ },
  lowStock: { href: "/low-stock", label: "Co się kończy", perm: PERM.LOW_STOCK_READ },
  reports: { href: "/reports", label: "Raporty", perm: PERM.REPORTS_ITEMS_READ },

  materials: { href: "/materials", label: "Katalog materiałów", perm: PERM.MATERIALS_READ },
  deliveries: { href: "/deliveries", label: "Dostawy", perm: PERM.DELIVERIES_READ },
  inventory: { href: "/inventory", label: "Inwentaryzacja", perm: PERM.INVENTORY_READ },
  dailyReports: { href: "/daily-reports", label: "Dzienne zużycie", perm: PERM.DAILY_REPORTS_READ },

  object: { href: "/object", label: "Obiekt i struktura", perm: PERM.PROJECT_MANAGE },
  team: { href: "/team", label: "Zespół", perm: PERM.TEAM_READ },
};

// helper: wywal “Analizy” gdy flaga OFF
function filterByFlags(items: NavItem[]) {
  if (FLAGS.metricsDevOnly) {
    return items.filter((i) => i.href !== ALL_ITEMS.analytics.href);
  }
  return items;
}

function roleSections(role: string | null): Section[] {
  const r = (role ?? "").toLowerCase();

  if (r === "worker") {
    return [
      {
        items: filterByFlags([
          ALL_ITEMS.materials,
          ALL_ITEMS.dailyReports,
          ALL_ITEMS.myTasks,
          ALL_ITEMS.team,
        ]),
      },
    ];
  }

  if (r === "foreman") {
    return [
      {
        title: "NAWIGACJA",
        items: filterByFlags([
          ALL_ITEMS.myTasks,
          ALL_ITEMS.analytics,
          ALL_ITEMS.lowStock,
          ALL_ITEMS.reports,
        ]),
      },
      {
        title: "MAGAZYN",
        items: [ALL_ITEMS.materials, ALL_ITEMS.dailyReports],
      },
      {
        title: "PROJEKT",
        items: [ALL_ITEMS.object, ALL_ITEMS.team],
      },
    ];
  }

  if (r === "storeman") {
    return [
      {
        title: "NAWIGACJA",
        items: filterByFlags([
          ALL_ITEMS.myTasks,
          ALL_ITEMS.analytics,
          ALL_ITEMS.lowStock,
          ALL_ITEMS.reports,
        ]),
      },
      {
        title: "MAGAZYN",
        items: [
          ALL_ITEMS.materials,
          ALL_ITEMS.deliveries,
          ALL_ITEMS.inventory,
          ALL_ITEMS.dailyReports,
        ],
      },
      {
        title: "PROJEKT",
        items: [ALL_ITEMS.team],
      },
    ];
  }

  // manager/owner
  return [
    {
      title: "NAWIGACJA",
      items: filterByFlags([
        ALL_ITEMS.myTasks,
        ALL_ITEMS.analytics,
        ALL_ITEMS.lowStock,
        ALL_ITEMS.reports,
      ]),
    },
    {
      title: "MAGAZYN",
      items: [
        ALL_ITEMS.materials,
        ALL_ITEMS.deliveries,
        ALL_ITEMS.inventory,
        ALL_ITEMS.dailyReports,
      ],
    },
    {
      title: "PROJEKT",
      items: [ALL_ITEMS.object, ALL_ITEMS.team],
    },
  ];
}

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function Sidebar() {
  const pathname = usePathname();
  const snapshot = usePermissionSnapshot();

  if (!snapshot) return null;

  const sections = roleSections(snapshot.role ?? null);
  const topActive = isActive(pathname, "/");

  return (
    <nav className="p-3 space-y-4">
      <Link
        href="/"
        className={[
          "block px-3 py-2 rounded-2xl border transition",
          topActive
            ? "bg-background border-border text-foreground"
            : "bg-background/20 border-border/60 text-foreground/85 hover:bg-background/35",
        ].join(" ")}
      >
        <div className="text-sm font-semibold tracking-tight">{APP_NAME}</div>
        <div className="text-[11px] text-foreground/55">Panel aplikacji</div>
      </Link>

      {sections.map((section, idx) => {
        const visible = section.items.filter((i) => can(snapshot, i.perm));
        if (visible.length === 0) return null;

        const showTitle = Boolean(section.title);

        return (
          <div key={`${section.title ?? "flat"}-${idx}`} className="space-y-2">
            {showTitle && (
              <div className="px-3 py-2 rounded-2xl bg-background/20 border border-border/60">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-foreground/70">
                  {section.title}
                </div>
              </div>
            )}

            <ul className="space-y-1">
              {visible.map((it) => {
                const active = isActive(pathname, it.href);

                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      className={[
                        "group flex items-center gap-2 px-3 py-2 rounded-2xl text-sm transition border",
                        active
                          ? "bg-background border-border text-foreground"
                          : "bg-transparent border-transparent text-foreground/75 hover:bg-background/25 hover:border-border/50",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "h-2 w-2 rounded-full",
                          active
                            ? "bg-foreground"
                            : "bg-foreground/25 group-hover:bg-foreground/35",
                        ].join(" ")}
                      />
                      <span className={active ? "font-semibold" : "font-medium"}>
                        {it.label}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
