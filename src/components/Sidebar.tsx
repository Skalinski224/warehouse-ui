// src/components/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccountRole } from "@/lib/RoleContext";

/**
 * Definicje sekcji oraz ich widoczności zależnie od roli.
 *
 * owner → korzysta z MENU.MANAGER (pełny dostęp)
 * manager → pełny dostęp (magazyn, operacje, projekt)
 * storeman → magazyn, operacje, zespół, moje zadania
 * worker → katalog, dzienne zużycie, zespół, moje zadania
 */
const MENU = {
  MANAGER: [
    {
      title: "Magazyn",
      items: [
        { href: "/", label: "Dashboard" },
        { href: "/low-stock", label: "Co się kończy" },
        { href: "/materials", label: "Katalog materiałów" },
      ],
    },
    {
      title: "Operacje",
      items: [
        { href: "/daily-reports", label: "Dzienne zużycie" },
        { href: "/deliveries", label: "Nowe dostawy" },
        { href: "/reports", label: "Raporty" },
      ],
    },
    {
      title: "Projekt",
      items: [
        { href: "/team", label: "Zespół" },
        { href: "/object", label: "Obiekt" },          // tylko owner/manager
        { href: "/tasks", label: "Moje zadania" },     // widok zadań brygady
      ],
    },
  ],

  STOREMAN: [
    {
      title: "Magazyn",
      items: [
        { href: "/", label: "Dashboard" },
        { href: "/low-stock", label: "Co się kończy" },
        { href: "/materials", label: "Katalog materiałów" },
      ],
    },
    {
      title: "Operacje",
      items: [
        { href: "/daily-reports", label: "Dzienne zużycie" },
        { href: "/deliveries", label: "Nowe dostawy" },
        { href: "/reports", label: "Raporty" }, // podstawowe raporty
      ],
    },
    {
      title: "Projekt",
      items: [
        { href: "/team", label: "Zespół" },
        { href: "/tasks", label: "Moje zadania" },
      ],
    },
  ],

  WORKER: [
    {
      title: "Magazyn",
      items: [{ href: "/materials", label: "Katalog materiałów" }],
    },
    {
      title: "Operacje",
      items: [
        { href: "/daily-reports", label: "Dzienne zużycie" },
        { href: "/tasks", label: "Moje zadania" },
      ],
    },
    {
      title: "Projekt",
      items: [{ href: "/team", label: "Zespół" }],
    },
  ],
};

export default function Sidebar() {
  const pathname = usePathname();
  const role = useAccountRole();

  // Brak roli → nic nie pokazujemy, user nie powinien być w app
  if (!role) return null;

  // Przypisanie zestawu menu do roli
  const sections =
    role === "manager" || role === "owner"
      ? MENU.MANAGER
      : role === "storeman"
      ? MENU.STOREMAN
      : MENU.WORKER;

  return (
    <nav className="p-3 space-y-5">
      {/* Brand */}
      <div className="px-3 py-2 text-sm font-semibold opacity-80">
        Warehouse UI
      </div>

      {sections.map((section, si) => (
        <div key={section.title} className="space-y-2">
          {/* Nagłówek sekcji */}
          <div
            className={[
              "px-3 py-1.5 text-[11px] font-semibold tracking-wider uppercase",
              "text-foreground/70",
              "border-y border-border/50 bg-background/40 rounded-md",
            ].join(" ")}
          >
            {section.title}
          </div>

          <ul className="space-y-1">
            {section.items.map((it) => {
              const active =
                pathname === it.href ||
                (it.href !== "/" && pathname?.startsWith(it.href + "/"));

              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    aria-current={active ? "page" : undefined}
                    className={[
                      "group block px-3 py-2 rounded-xl text-sm transition",
                      active
                        ? "bg-background text-foreground border border-border shadow-sm"
                        : "text-foreground/70 hover:text-foreground hover:bg-background/40",
                    ].join(" ")}
                  >
                    <span className="inline-flex items-center gap-2">
                      <span
                        className={[
                          "h-1.5 w-1.5 rounded-full transition",
                          active
                            ? "bg-foreground"
                            : "bg-foreground/30 group-hover:bg-foreground/60",
                        ].join(" ")}
                      />
                      {it.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>

          {si < sections.length - 1 && (
            <div className="px-3">
              <div className="h-px bg-border/60" />
            </div>
          )}
        </div>
      ))}
    </nav>
  );
}
