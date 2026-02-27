// src/app/(app)/reports/_lib/reportCards.ts
import { can, PERM } from "@/lib/permissions";

export const MATERIALS_AUDIT_READ =
  (PERM as any).MATERIALS_AUDIT_READ ??
  (PERM as any).MATERIALS_CHANGES_READ ??
  "materials.audit.read";

// ✅ fallback dla transferów (bo PERM może nie mieć stałej)
export const REPORTS_TRANSFERS_READ =
  (PERM as any).REPORTS_TRANSFERS_READ ?? "reports.transfers.read";

export const REPORT_CARDS = [
  {
    href: "/reports/deliveries",
    title: "Raport o dostawach",
    desc: "Dostawy, statusy, koszty",
    perm: PERM.REPORTS_DELIVERIES_READ,
  },
  {
    href: "/reports/daily",
    title: "Raporty dzienne",
    desc: "Zużycie materiałów wg brygad",
    perm: PERM.DAILY_REPORTS_READ,
  },
  {
    href: "/reports/stages",
    title: "Etap projektu",
    desc: "Postęp prac per etap",
    perm: PERM.REPORTS_STAGES_READ,
  },
  {
    href: "/reports/items",
    title: "Wszystkie przedmioty",
    desc: "Stan, historia, rotacja",
    perm: PERM.REPORTS_ITEMS_READ,
  },

  // ✅ transfery (teraz pewne, że perm nie będzie undefined)
  {
    href: "/reports/transfers",
    title: "Transfery",
    desc: "Raporty przeniesień między lokalizacjami",
    perm: REPORTS_TRANSFERS_READ as any,
  },

  {
    href: "/reports/inventory",
    title: "Inwentaryzacja",
    desc: "Historia zatwierdzonych inwentaryzacji",
    perm: PERM.REPORTS_INVENTORY_READ,
  },

  {
    href: "/reports/materials-changes",
    title: "Zmiany w materiałach",
    desc: "Kto, kiedy i co zmienił (kontrola zmian)",
    perm: MATERIALS_AUDIT_READ as any,
    gate: "owner_manager_only" as const,
  },
] as const;

export function getVisibleReportCards(snap: any) {
  const role = (snap as any)?.role;

  return REPORT_CARDS.filter((c) => {
    if ((c as any).gate === "owner_manager_only") {
      return role === "owner" || role === "manager";
    }
    return can(snap as any, (c as any).perm);
  });
}