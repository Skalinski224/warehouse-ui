"use client";
import ReportFilters, { ReportFiltersValue } from "@/components/ReportFilters";

export default function DeliveriesReportView() {
  const onApply = (v: ReportFiltersValue) => console.log("deliveries filters", v);
  return (
    <>
      <ReportFilters onApply={onApply} />
      <div className="border rounded p-3">Placeholder wyników…</div>
    </>
  );
}
