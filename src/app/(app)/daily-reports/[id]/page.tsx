import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";
import { can, PERM, type PermissionSnapshot } from "@/lib/permissions";

type PageProps = {
  params: { id: string };
};

export const dynamic = "force-dynamic";

function coerceSnapshot(data: any): PermissionSnapshot | null {
  if (!data) return null;
  if (Array.isArray(data)) return (data[0] as PermissionSnapshot | null) ?? null;
  return data as PermissionSnapshot;
}

export default async function LegacyDailyReportRedirect({ params }: PageProps) {
  const supabase = await supabaseServer();

  const { data, error } = await supabase.rpc("my_permissions_snapshot");
  const snapshot = coerceSnapshot(data);

  // Brak snapshotu / błąd → wylot
  if (!snapshot || error) redirect("/");

  /**
   * ZASADA (zamykanie tego co się da):
   * - worker NIE ogląda raportów po fakcie → blokujemy wejście w widok pojedynczego raportu
   * - foreman też nie (bo nie ma widzieć listy/podglądu)
   * - storeman / manager / owner → mogą
   */
  if (snapshot.role === "worker" || snapshot.role === "foreman") {
    redirect("/daily-reports");
  }

  // Dodatkowy bezpiecznik: musi mieć read
  if (!can(snapshot, PERM.DAILY_REPORTS_READ)) {
    redirect("/daily-reports");
  }

  // Legacy redirect do raportów
  redirect(`/reports/daily/${params.id}`);
}
