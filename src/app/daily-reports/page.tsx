// app/daily-reports/page.tsx
import { supabase } from "@/lib/supabaseClient";
import DailyReportForm from "@/components/DailyReportForm";
import ApproveButton from "@/components/ApproveButton";

async function fetchMaterials() {
  const { data, error } = await supabase
    .from("materials")
    .select("id,name,unit")
    .order("name", { ascending: true })
    .limit(300);
  if (error) return [];
  return data ?? [];
}

async function fetchTeam() {
  const { data, error } = await supabase
    .from("team_members") // tabela: id, name
    .select("id,name")
    .order("name", { ascending: true })
    .limit(300);
  if (error) return [];
  return data ?? [];
}

async function fetchLatestPending() {
  const { data, error } = await supabase
    .from("daily_reports")
    .select("id, crew, place_id, date, status")
    .eq("status", "pending")
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data ?? null;
}

export default async function Page() {
  const [materials, coworkers, latestPending] = await Promise.all([
    fetchMaterials(),
    fetchTeam(),
    fetchLatestPending(),
  ]);

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Dzienne zużycie — nowy raport</h1>

      {/* Jedno miejsce do zatwierdzenia (opcjonalne) */}
      {latestPending && (
        <section className="border rounded p-3 flex items-center justify-between bg-zinc-50/40 dark:bg-zinc-900">
          <div className="text-sm">
            <div className="font-medium">Do zatwierdzenia:</div>
            <div>
              {latestPending.crew} • {latestPending.place_id} • {latestPending.date}
            </div>
          </div>
          <form action={"/api/approve-daily-report"} method="post">
            <input type="hidden" name="report_id" value={latestPending.id} />
            <ApproveButton>Akceptuj</ApproveButton>
          </form>
        </section>
      )}

      {/* Sam formularz */}
      <DailyReportForm materials={materials} coworkersOptions={coworkers} />
    </main>
  );
}
