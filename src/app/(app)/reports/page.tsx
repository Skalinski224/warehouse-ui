// src/app/(app)/reports/page.tsx
import { supabaseServer } from "@/lib/supabaseServer";
import { getPermissionSnapshot } from "@/lib/currentUser";
import ReportsLandingClient from "./_components/ReportsLandingClient";
import { getVisibleReportCards } from "./_lib/reportCards";

export default async function Page() {
  await supabaseServer();
  const snap = await getPermissionSnapshot();

  const visible = getVisibleReportCards(snap);

  if (visible.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="text-sm text-foreground/80">Brak dostępu.</div>
      </div>
    );
  }

  const firstHref = visible[0]?.href ?? null;

  return <ReportsLandingClient visible={visible as any} firstHref={firstHref} />;
}
