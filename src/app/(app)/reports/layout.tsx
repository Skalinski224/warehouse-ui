// src/app/(app)/reports/layout.tsx
import Link from "next/link";
import { supabaseServer } from "@/lib/supabaseServer";
import { getPermissionSnapshot } from "@/lib/currentUser";
import { getVisibleReportCards } from "./_lib/reportCards";

export default async function ReportsLayout({ children }: { children: React.ReactNode }) {
  await supabaseServer();
  const snap = await getPermissionSnapshot();
  const visible = getVisibleReportCards(snap);

  // Na desktop sidebar ma być zawsze – nawet jeśli user nie ma nic (wtedy pokazujemy "Brak dostępu")
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Raporty</h1>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        {/* ✅ "sidebar" tylko na desktop */}
        <aside className="hidden lg:block">
          <div className="rounded-2xl border border-border bg-card p-2 sticky top-4">
            {visible.length === 0 ? (
              <div className="p-3 text-sm text-foreground/70">Brak dostępu.</div>
            ) : (
              <nav className="grid gap-1">
                {visible.map((c) => (
                  <Link
                    key={c.href}
                    href={c.href}
                    className="rounded-xl border border-transparent px-3 py-2 hover:bg-background/40 hover:border-border transition"
                  >
                    <div className="text-sm font-medium">{c.title}</div>
                    <div className="text-[11px] text-muted-foreground">{c.desc}</div>
                  </Link>
                ))}
              </nav>
            )}
          </div>
        </aside>

        {/* Content */}
        <section className="min-w-0">{children}</section>
      </div>
    </div>
  );
}
