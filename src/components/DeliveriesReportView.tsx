"use client";

import ReportFilters, { ReportFiltersValue } from "@/components/ReportFilters";
import { PERM, can } from "@/lib/permissions";
import { usePermissionSnapshot } from "@/lib/RoleContext";

export default function DeliveriesReportView() {
  const snapshot = usePermissionSnapshot();

  // Gate całego widoku raportu dostaw
  if (!can(snapshot, PERM.REPORTS_DELIVERIES_READ)) {
    return (
      <div className="border border-border/60 bg-card rounded p-4 text-sm text-foreground/70">
        Brak dostępu.
      </div>
    );
  }

  const onApply = (v: ReportFiltersValue) =>
    console.log("deliveries filters", v);

  return (
    <>
      <ReportFilters onApply={onApply} />
      <div className="border rounded p-3">Placeholder wyników…</div>
    </>
  );
}
