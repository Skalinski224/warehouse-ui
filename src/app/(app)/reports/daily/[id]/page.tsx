// src/app/(app)/reports/daily/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";

import { fetchDailyReportById } from "@/lib/queries/dailyReports";
import type { DailyReportDetails } from "@/lib/dto";
import ReportPhotosLightbox from "@/components/ReportPhotosLightbox";
import { getPermissionSnapshot } from "@/lib/currentUser";
import { can, PERM } from "@/lib/permissions";
import { supabaseServer } from "@/lib/supabaseServer";

type PageProps = {
  params: { id: string };
};

/* ------------------------------------------------------------------ */
/* UI helpers                                                          */
/* ------------------------------------------------------------------ */

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "ok" | "warn" | "bad";
  className?: string;
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
    <span
      className={cx(
        "text-[11px] px-2 py-1 rounded-full border whitespace-nowrap leading-none",
        cls,
        className
      )}
    >
      {children}
    </span>
  );
}

function Field({
  label,
  value,
  strong,
}: {
  label: string;
  value: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground/90">
        {label}
      </div>
      <div className={cx("text-[15px] leading-snug", strong && "font-semibold")}>
        {value}
      </div>
    </div>
  );
}

function statusMeta(approved: boolean) {
  return approved
    ? { text: "zaakceptowane", tone: "ok" as const }
    : { text: "zadanie w toku", tone: "warn" as const };
}

/* ------------------------------------------------------------------ */
/* Photos (signed)                                                     */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

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

  // ✅ inventory location label (source of truth from your query file)
  // NOTE: fetchDailyReportById currently DOES NOT join inventory_locations.
  // We keep UI ready for production by falling back to report.location when label is absent.
  // If/when you add inventoryLocationLabel to DailyReportDetails, this will start showing it automatically.
  const inventoryLocationLabel =
  report.inventoryLocationLabel ||
  report.location ||
  "—";

  const st = statusMeta(!!report.approved);

  const primaryCrew =
    report.crews.find((c) => c.isPrimary) ??
    (report.crewId
      ? { crewId: report.crewId, crewName: report.crewName, isPrimary: true }
      : null);

  const secondaryCrews = report.crews.filter((c) => !c.isPrimary);

  const signedPhotos = await toSignedUrls(report.images ?? []);

  const personLabel = report.person || "—";
  const placeLabel = report.place || "—";
  const taskLabel = report.taskName || "—";

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-base font-semibold">Raport dzienny</h1>
          <p className="text-xs opacity-70">
            Szczegóły zużycia materiałów i wykonanych prac.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge className="px-3" tone={st.tone}>
            {st.text}
          </Badge>
          <Badge className="px-3">
            ID #{String(report.id ?? id).slice(0, 8)}
          </Badge>
        </div>
      </header>

      {/* MAIN GRID: LEFT (meta+task+photos) / RIGHT (materials) */}
      <section className="grid gap-4 lg:grid-cols-2 items-start">
        {/* LEFT */}
        <div className="space-y-4">
          {/* BIG META PANEL (one place, two columns on larger) */}
          <section className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-sm font-medium">Podstawowe informacje</div>
                <div className="flex items-center gap-2">
                  {/* Only two statuses you requested */}
                  <Badge tone={st.tone}>
                    {st.text}
                  </Badge>
                  {/* "task in progress" should be translucent yellow */}
                  {!report.approved ? (
                    <span className="hidden" />
                  ) : null}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Data" value={report.date || "—"} strong />
                <Field label="Osoba" value={personLabel} strong />

                <Field label="Miejsce pracy" value={placeLabel} />
                <Field label="Lokalizacja magazynowa" value={inventoryLocationLabel} />

                <Field label="Brygada główna" value={primaryCrew?.crewName ?? "—"} />
                <Field label="Brygady pomocnicze" value={secondaryCrews.length} />

                <Field label="Ilość pozycji" value={report.items.length} />
                <Field label="Ilość zdjęć" value={signedPhotos.length} />
              </div>

              {/* translucent yellow pill as “zadanie w toku” (separate, always visible if not approved) */}
              {!report.approved ? (
                <div className="mt-1">
                  <span className="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-600/10 px-3 py-1 text-[12px] text-amber-200">
                    zadanie w toku
                  </span>
                </div>
              ) : null}

              {/* secondary crews list - clean */}
              {secondaryCrews.length > 0 ? (
                <div className="pt-3 border-t border-border/70">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground/90 mb-2">
                    Brygady pomocnicze (nazwy)
                  </div>
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
                </div>
              ) : null}
            </div>
          </section>

          {/* TASK PANEL + PHOTOS inside same area (below meta) */}
          <section className="rounded-2xl border border-border bg-card p-4 space-y-4">
            <div className="space-y-1">
              <div className="text-sm font-medium">Zadanie</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Nazwa zadania"
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
                  strong
                />
                <Field
                  label="Etap (ID)"
                  value={report.stageId ? String(report.stageId) : "—"}
                />
              </div>
            </div>

            <div className="pt-3 border-t border-border/70 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium">Zdjęcia</div>
                <Badge>{signedPhotos.length} szt.</Badge>
              </div>

              {signedPhotos.length === 0 ? (
                <div className="rounded-2xl border border-border bg-background/30 p-4 text-sm opacity-70">
                  Brak zdjęć w tym raporcie.
                </div>
              ) : (
                <ReportPhotosLightbox photos={signedPhotos} />
              )}
            </div>
          </section>
        </div>

        {/* RIGHT: MATERIALS (keep current “informational layout”, but cleaned + production) */}
        <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-sm font-medium">
                Zużyte materiały{" "}
                <span className="text-xs opacity-70">
                  ( {inventoryLocationLabel} )
                </span>
              </h2>
              <div className="text-xs opacity-70">Pozycje: {report.items.length}</div>
            </div>
            <Badge>pozycji: {report.items.length}</Badge>
          </div>

          {report.items.length === 0 ? (
            <div className="rounded-2xl border border-border bg-background/30 p-4 text-sm opacity-70">
              Brak zużyć w tym raporcie.
            </div>
          ) : (
            <div className="space-y-2">
              {report.items.map((item) => {
                const after = item.currentQuantity ?? 0;
                const before = after + item.qtyUsed;

                return (
                  <Link
                    key={item.materialId}
                    href={`/materials/${item.materialId}`}
                    className={cx(
                      "block rounded-2xl border border-border bg-background/20 hover:bg-background/30 transition",
                      "p-3"
                    )}
                  >
                    {/* header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[15px] font-semibold truncate">
                          {item.materialTitle || "Nieznany materiał"}
                        </div>
                        <div className="text-xs opacity-70 mt-0.5">
                          Jednostka: {item.unit || "—"}
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground/90">
                          Zużyto
                        </div>
                        <div className="text-[16px] font-semibold leading-none">
                          {item.qtyUsed}
                        </div>
                      </div>
                    </div>

                    {/* details row (not cramped) */}
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-xl border border-border bg-background/30 px-3 py-2">
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground/90">
                          Stan przed
                        </div>
                        <div className="text-[14px] font-semibold">{before}</div>
                      </div>

                      <div className="rounded-xl border border-border bg-background/30 px-3 py-2">
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground/90">
                          Stan po
                        </div>
                        <div className="text-[14px] font-semibold">{after}</div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </section>
    </div>
  );
}