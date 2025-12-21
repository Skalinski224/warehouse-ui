// src/app/(app)/reports/daily/[id]/page.tsx  (albo Twoja ścieżka – tu nie podałeś)
import { notFound } from "next/navigation";
import Link from "next/link";

import { fetchDailyReportById } from "@/lib/queries/dailyReports";
import type { DailyReportDetails } from "@/lib/dto";
import ReportPhotosLightbox from "@/components/ReportPhotosLightbox";
import { getPermissionSnapshot } from "@/lib/currentUser";
import { can, PERM } from "@/lib/permissions";
import { supabaseServer } from "@/lib/supabaseServer";
import BackButton from "@/components/BackButton";

type PageProps = {
  params: { id: string };
};

function Tag({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "ok" | "warn" | "bad";
}) {
  const cls =
    tone === "ok"
      ? "border-emerald-500/40 bg-emerald-600/10 text-emerald-200"
      : tone === "warn"
      ? "border-amber-500/40 bg-amber-600/10 text-amber-200"
      : tone === "bad"
      ? "border-red-500/40 bg-red-600/10 text-red-200"
      : "border-border bg-background/40 text-foreground/80";

  return (
    <span className={`text-[10px] px-2 py-0.5 rounded border ${cls}`}>
      {children}
    </span>
  );
}

function Pill({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <span className="text-[11px] px-2 py-1 rounded bg-background/60 border border-border">
      <span className="opacity-70">{label}:</span>{" "}
      <span className="font-semibold opacity-100">{value}</span>
    </span>
  );
}

function KV({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "neutral" | "ok" | "warn" | "bad";
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Tag tone={tone}>{label}</Tag>
      <div className="text-sm">{value}</div>
    </div>
  );
}

function StatusText(approved: boolean) {
  return approved ? { text: "zaakceptowany", tone: "ok" as const } : { text: "oczekuje", tone: "warn" as const };
}

function isImagePath(p: string) {
  const s = String(p || "").toLowerCase();
  return (
    s.endsWith(".png") ||
    s.endsWith(".jpg") ||
    s.endsWith(".jpeg") ||
    s.endsWith(".webp") ||
    s.endsWith(".gif")
  );
}

async function toSignedUrls(paths: string[]): Promise<string[]> {
  const sb = await supabaseServer();
  const clean = (paths ?? []).filter(Boolean).slice(0, 3);

  const out: string[] = [];
  for (const p of clean) {
    if (!isImagePath(p)) continue;

    const { data, error } = await sb.storage
      .from("report-images")
      .createSignedUrl(p, 60 * 60); // 1h

    if (!error && data?.signedUrl) out.push(data.signedUrl);
  }
  return out;
}

export default async function DailyReportDetailsPage({ params }: PageProps) {
  // ✅ Gate
  const snap = await getPermissionSnapshot();
  if (!can(snap, PERM.DAILY_REPORTS_READ)) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="text-sm text-foreground/80">Brak dostępu.</div>
      </div>
    );
  }

  const { id } = params;

  const report: DailyReportDetails | null = await fetchDailyReportById(id);
  if (!report) notFound();

  const primaryCrew =
    report.crews.find((c) => c.isPrimary) ??
    (report.crewId
      ? { crewId: report.crewId, crewName: report.crewName, isPrimary: true }
      : null);

  const secondaryCrews = report.crews.filter((c) => !c.isPrimary);

  const signedPhotos = await toSignedUrls(report.images ?? []);

  const st = StatusText(!!report.approved);

  const placeLabel = report.place || "—";
  const locationLabel = report.location || "—";
  const personLabel = report.person || "—";
  const taskLabel = report.taskName || "—";

  return (
    <div className="space-y-4">
      {/* HEADER (kanon) */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-sm font-medium">Raport: dzienne zużycie</h1>
          <p className="text-xs opacity-70">
            Szczegóły prac i zużycia materiałów dla wybranego dnia.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Pill label="ID" value={`#${String(report.id ?? id).slice(0, 8)}`} />
          <BackButton className="px-3 py-2 rounded border border-border bg-card hover:bg-card/80 text-xs transition" />
        </div>
      </header>

      {/* META BAR (pigułki “na tacy”) */}
      <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Pill label="DATA" value={report.date} />
          <span className="inline-flex items-center gap-2">
            <Tag>STATUS</Tag>
            <Tag tone={st.tone}>{st.text}</Tag>
          </span>
          {report.isCompleted ? <Tag tone="ok">zadanie zakończone</Tag> : <Tag>zadanie w toku</Tag>}
          <Pill label="POZYCJI" value={report.items.length} />
          <Pill label="ZDJĘĆ" value={signedPhotos.length} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Pill label="OSOBA" value={personLabel} />
          <Pill label="LOKALIZACJA" value={locationLabel} />
          <Pill label="MIEJSCE" value={placeLabel} />
          <Pill label="GŁÓWNA BRYGADA" value={primaryCrew?.crewName ?? "—"} />
          <Pill label="POMOCNICZE" value={secondaryCrews.length} />
        </div>
      </section>

      {/* GRID: lewa info / prawa materiały (na dużych) */}
      <section className="grid gap-4 lg:grid-cols-2">
        {/* LEWA: Informacje + Zadanie + Uczestnicy */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <h2 className="text-sm font-medium">Informacje</h2>

            <div className="space-y-2">
              <KV label="KIEDY" value={report.date} />
              <KV label="KTO" value={personLabel} />
              <KV label="GDZIE" value={locationLabel} />
            </div>

            <div className="pt-3 border-t border-border/70 space-y-2">
              <KV label="BRYGADA GŁÓWNA" value={primaryCrew?.crewName ?? "—"} />
              <KV
                label="BRYGADY POMOCNICZE"
                value={
                  secondaryCrews.length === 0 ? (
                    <span className="opacity-70">brak</span>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {secondaryCrews.map((c) => (
                        <span
                          key={c.crewId}
                          className="inline-flex rounded-full border border-border px-2 py-0.5 text-xs"
                        >
                          {c.crewName || "(bez nazwy)"}
                        </span>
                      ))}
                    </div>
                  )
                }
              />
            </div>

            <div className="pt-3 border-t border-border/70 space-y-2">
              <KV
                label="UCZESTNICY"
                value={
                  report.members.length === 0 ? (
                    <span className="opacity-70">brak przypisanych członków</span>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {report.members.map((m) => (
                        <span
                          key={m.memberId}
                          className="inline-flex rounded-full border border-border px-2 py-0.5 text-xs"
                        >
                          {m.firstName} {m.lastName ?? ""}
                        </span>
                      ))}
                    </div>
                  )
                }
              />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <h2 className="text-sm font-medium">Zadanie</h2>

            <div className="space-y-2">
              <KV
                label="CO"
                value={
                  report.taskId ? (
                    <Link
                      href={`/tasks/${report.taskId}`}
                      className="underline underline-offset-2 hover:opacity-100 opacity-90"
                    >
                      {taskLabel}
                    </Link>
                  ) : (
                    taskLabel
                  )
                }
              />

              <KV
                label="MIEJSCE / ETAP"
                value={
                  <span>
                    {placeLabel}
                    {report.stageId ? (
                      <span className="text-xs opacity-70"> (etap: {report.stageId})</span>
                    ) : null}
                  </span>
                }
              />
            </div>
          </div>
        </div>

        {/* PRAWA: Materiały */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium">Zużyte materiały</h2>
            <Pill label="POZYCJI" value={report.items.length} />
          </div>

          {report.items.length === 0 ? (
            <div className="rounded-2xl border border-border bg-background/30 p-4 text-sm opacity-70">
              W tym raporcie nie odnotowano zużycia materiałów.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border/60">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-background/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Materiał</th>
                    <th className="px-3 py-2 text-left">Jedn.</th>
                    <th className="px-3 py-2 text-right">Zużycie</th>
                    <th className="px-3 py-2 text-right">Stan po</th>
                    <th className="px-3 py-2 text-right text-[11px]">Stan przed</th>
                  </tr>
                </thead>
                <tbody>
                  {report.items.map((item) => {
                    const after = item.currentQuantity ?? 0;
                    const before = after + item.qtyUsed;

                    return (
                      <tr key={item.materialId} className="border-t border-border/60">
                        <td className="px-3 py-2">
                          <div className="text-sm">
                            {item.materialTitle || "Nieznany materiał"}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          {item.unit || <span className="text-xs opacity-70">—</span>}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className="sm:hidden opacity-60 mr-1">ZUŻYCIE:</span>
                          <span className="font-medium">{item.qtyUsed}</span>
                        </td>
                        <td className="px-3 py-2 text-right">{after}</td>
                        <td className="px-3 py-2 text-right text-xs opacity-70">{before}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ZDJĘCIA */}
          <div className="pt-3 border-t border-border/70 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium">Zdjęcia</h2>
              <Pill label="SZT." value={signedPhotos.length} />
            </div>

            {signedPhotos.length === 0 ? (
              <div className="rounded-2xl border border-border bg-background/30 p-4 text-sm opacity-70">
                Do tego raportu nie dodano zdjęć.
              </div>
            ) : (
              <ReportPhotosLightbox photos={signedPhotos} />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
