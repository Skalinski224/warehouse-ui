// src/app/(app)/reports/layout.tsx
import { supabaseServer } from "@/lib/supabaseServer";
import { getPermissionSnapshot } from "@/lib/currentUser";
import { getVisibleReportCards } from "./_lib/reportCards";
import ReportsNav from "./_components/ReportsNav";
import BackButton from "@/components/BackButton";

export default async function ReportsLayout({ children }: { children: React.ReactNode }) {
  await supabaseServer();
  const snap = await getPermissionSnapshot();
  const visible = getVisibleReportCards(snap);

  return (
    <div className="space-y-4">
      {/* ✅ header raportów + back (zawsze nad menu) */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg md:text-2xl font-semibold">Raporty</h1>
        </div>
        <BackButton />
      </div>

      {/* ✅ MOBILE/TABLET: menu bezpośrednio pod back, potem content */}
      <div className="space-y-4 lg:hidden">
        <ReportsNav visible={visible as any} />
        <section className="min-w-0">{children}</section>
      </div>

      {/* ✅ DESKTOP: grid (sidebar + content) */}
      <div className="hidden lg:grid gap-6 lg:grid-cols-[260px_1fr]">
        <ReportsNav visible={visible as any} />
        <section className="min-w-0">{children}</section>
      </div>
    </div>
  );
}