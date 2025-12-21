// src/app/(app)/reports/tasks/[taskId]/page.tsx
import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import { supabaseServer } from "@/lib/supabaseServer";
import BackButton from "@/components/BackButton";
import ReportPhotosLightbox from "@/components/ReportPhotosLightbox";

import { getPermissionSnapshot } from "@/lib/currentUser";
import { can, PERM } from "@/lib/permissions";

type TaskStatus = "todo" | "in_progress" | "done";

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  placeName: string | null;
};

type TaskAttachmentRow = { id: string; url: string };

type DailyReportRow = {
  id: string;
  date: string;
  person: string | null;
  isCompleted: boolean;
  images: string[] | null; // PATHY w report-images
};

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v
  );
}

function StatPill({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <span className="text-[11px] px-2 py-1 rounded bg-background/60 border border-border">
      <span className="opacity-70">{label}:</span>{" "}
      <span className="font-semibold opacity-100">{value}</span>
    </span>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: "emerald" | "amber" | "zinc" | "red";
  children: React.ReactNode;
}) {
  const cls =
    tone === "emerald"
      ? "bg-emerald-600/20 text-emerald-300 border border-emerald-500/40"
      : tone === "amber"
      ? "bg-amber-600/20 text-amber-300 border border-amber-500/40"
      : tone === "red"
      ? "bg-red-600/20 text-red-300 border border-red-500/40"
      : "bg-zinc-600/20 text-zinc-300 border border-zinc-500/40";

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] ${cls}`}>
      {children}
    </span>
  );
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

/**
 * ✅ to jest dokładnie to, co masz w /tasks/[taskId]/page.tsx
 * - url potrafi być pełnym linkiem do storage
 * - wycinamy sam PATH
 */
function normalizeStoragePath(p: string): string {
  const raw = String(p ?? "").trim();
  if (!raw) return "";

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      const u = new URL(raw);
      const pathname = u.pathname || "";
      const marker = "/storage/v1/object/";
      const i = pathname.indexOf(marker);
      if (i >= 0) {
        const rest = pathname.slice(i + marker.length); // "public/task-images/.."
        const parts = rest.split("/").filter(Boolean);
        // parts: ["public","task-images","<path...>"] albo ["sign","task-images","<path...>"]
        if (parts.length >= 3) return decodeURIComponent(parts.slice(2).join("/"));
      }
      return decodeURIComponent(pathname.replace(/^\/+/, ""));
    } catch {
      return raw;
    }
  }

  return raw.replace(/^\/+/, "");
}

async function signUrlsFromBucket(paths: string[], bucket: string, limit = 12): Promise<string[]> {
  const sb = await supabaseServer();
  const clean = (paths ?? [])
    .filter(Boolean)
    .map((p) => normalizeStoragePath(p))
    .filter(Boolean)
    .filter(isImagePath)
    .slice(0, limit);

  if (clean.length === 0) return [];

  const out: string[] = [];
  for (const p of clean) {
    const { data, error } = await sb.storage.from(bucket).createSignedUrl(p, 60 * 60);
    if (!error && data?.signedUrl) out.push(data.signedUrl);
  }
  return out;
}

async function fetchTask(taskId: string): Promise<TaskRow | null> {
  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from("project_tasks")
    .select(
      `
        id,
        title,
        description,
        status,
        project_places ( name )
      `
    )
    .eq("id", taskId)
    .maybeSingle();

  if (error) {
    console.error("[reports/tasks/[taskId]] task error:", error);
    return null;
  }
  if (!data) return null;

  const row: any = data;
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    description: (row.description as string | null) ?? null,
    status: (row.status as TaskStatus) ?? "todo",
    placeName: (row.project_places?.name as string | null) ?? null,
  };
}

/**
 * ✅ zdjęcia zadania bierzemy jak w /tasks/[taskId]:
 * table: task_attachments (id, url, created_at)
 * bucket: task-images
 */
async function fetchTaskAttachments(taskId: string): Promise<TaskAttachmentRow[]> {
  const supabase = await supabaseServer();

  const res = await supabase
    .from("task_attachments")
    .select("id, url, created_at")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  if (res.error) {
    console.error("[reports/tasks/[taskId]] task_attachments error:", res.error);
    return [];
  }

  return (res.data ?? []).map((r: any) => ({
    id: String(r.id),
    url: String(r.url ?? ""),
  }));
}

async function fetchReports(taskId: string): Promise<DailyReportRow[]> {
  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from("daily_reports")
    .select("id, date, person, is_completed, images")
    .eq("task_id", taskId)
    .order("date", { ascending: true });

  if (error) {
    console.error("[reports/tasks/[taskId]] daily_reports error:", error);
    return [];
  }

  const rows = (data ?? []) as any[];
  return rows.map((r) => ({
    id: String(r.id),
    date: String(r.date),
    person: (r.person as string | null) ?? null,
    isCompleted: Boolean(r.is_completed),
    images: Array.isArray(r.images)
      ? (r.images as unknown[]).filter((p): p is string => typeof p === "string")
      : null,
  }));
}

export default async function Page({
  params,
}: {
  params: Promise<{ id?: string; taskId?: string }> | { id?: string; taskId?: string };
}) {
  const p = (await Promise.resolve(params)) as { id?: string; taskId?: string };
  const taskId = String(p.taskId ?? p.id ?? "").trim();

  if (!taskId || taskId === "undefined" || !isUuid(taskId)) notFound();

  // ✅ Gate
  const snap = await getPermissionSnapshot();
  if (!can(snap, PERM.REPORTS_STAGES_READ)) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="text-sm text-foreground/80">Brak dostępu.</div>
      </div>
    );
  }

  const task = await fetchTask(taskId);
  if (!task) notFound();

  // ten ekran ma sens tylko dla done
  if (task.status !== "done") {
    redirect(`/tasks/${taskId}`);
  }

  const [attachments, reports] = await Promise.all([
    fetchTaskAttachments(taskId),
    fetchReports(taskId),
  ]);

  // ✅ Zdjęcia taska: task-images
  const taskPhotoPaths = attachments.map((a) => a.url).filter(Boolean);
  const taskPhotos = await signUrlsFromBucket(taskPhotoPaths, "task-images", 24);

  // ✅ Raport zamykający i jego zdjęcia: report-images
  const completedReports = reports.filter((r) => r.isCompleted);
  const closingReport =
    completedReports.length > 0 ? completedReports[completedReports.length - 1] : null;

  const closingPhotos = closingReport?.images
    ? await signUrlsFromBucket(closingReport.images, "report-images", 24)
    : [];

  const placeLabel = task.placeName?.trim() ? task.placeName : "—";

  return (
    <div className="space-y-4">
      {/* HEADER (KANON) */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-sm font-medium">Raport zadania</h1>
          <p className="text-xs opacity-70">
            Podsumowanie zakończonego zadania: meta + zdjęcia z planowania (task) i realizacji (raporty dzienne).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <StatPill label="Status" value={<Badge tone="emerald">zakończone</Badge>} />
          <StatPill label="Raportów" value={reports.length} />
          <BackButton className="px-3 py-2 rounded border border-border bg-card hover:bg-card/80 text-xs transition" />
        </div>
      </div>

      {/* META */}
      <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] opacity-70">Zadanie</div>
            <div className="text-lg font-semibold truncate">{task.title}</div>
            <div className="text-xs opacity-70">
              ID: <span className="font-mono">{task.id}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 justify-end">
            <StatPill label="Miejsce" value={<span className="truncate">{placeLabel}</span>} />
            <StatPill label="Tryb" value="raportowy" />
          </div>
        </div>

        {task.description?.trim() ? (
          <div className="rounded-xl border border-border bg-background/20 p-3">
            <div className="text-[11px] opacity-70 mb-1">Opis</div>
            <div className="text-sm whitespace-pre-wrap">{task.description}</div>
          </div>
        ) : (
          <div className="text-xs opacity-70">Brak opisu zadania.</div>
        )}
      </section>

      {/* ZDJĘCIA ZADANIA (TASK) */}
      <section className="rounded-2xl border border-border bg-card p-4 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Zdjęcia zadania</div>
            <div className="text-xs opacity-70">
              Zdjęcia przypięte do zadania (task_attachments → bucket task-images).
            </div>
          </div>

          <Badge tone={taskPhotos.length > 0 ? "emerald" : "zinc"}>
            {taskPhotos.length > 0 ? `jest: ${taskPhotos.length}` : "brak"}
          </Badge>
        </div>

        {taskPhotos.length === 0 ? (
          <div className="text-xs opacity-70">Brak zdjęć przypiętych do zadania.</div>
        ) : (
          <ReportPhotosLightbox photos={taskPhotos} />
        )}
      </section>

      {/* RAPORT ZAMYKAJĄCY (DAILY REPORT) */}
      <section className="rounded-2xl border border-border bg-card p-4 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Raport zamykający</div>
            <div className="text-xs opacity-70">
              Ostatni raport dzienny z is_completed = true (daily_reports.images → bucket report-images).
            </div>
          </div>

          {closingReport ? <Badge tone="emerald">znaleziony</Badge> : <Badge tone="amber">brak</Badge>}
        </div>

        {!closingReport ? (
          <div className="text-xs opacity-70">Nie znaleziono raportu kończącego dla tego zadania.</div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-background/20 p-3">
              <div className="grid gap-2 sm:grid-cols-3">
                <div>
                  <div className="text-[11px] opacity-70">Data</div>
                  <div className="text-sm font-medium">{closingReport.date}</div>
                </div>
                <div>
                  <div className="text-[11px] opacity-70">Osoba</div>
                  <div className="text-sm font-medium">{closingReport.person ?? "—"}</div>
                </div>
                <div className="flex items-end justify-start sm:justify-end">
                  <Link
                    href={`/daily-reports/${closingReport.id}`}
                    className="px-3 py-2 rounded border border-border bg-background text-xs hover:bg-background/80 transition"
                  >
                    Otwórz raport dzienny →
                  </Link>
                </div>
              </div>
            </div>

            {closingPhotos.length === 0 ? (
              <div className="text-xs opacity-70">
                Raport zamykający nie ma zdjęć (albo nie udało się wygenerować linków).
              </div>
            ) : (
              <ReportPhotosLightbox photos={closingPhotos} />
            )}
          </div>
        )}
      </section>

      {/* HISTORIA */}
      <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Historia raportów dziennych</div>
            <div className="text-xs opacity-70">Kliknij pozycję, aby wejść w raport dzienny.</div>
          </div>
          <StatPill label="Łącznie" value={reports.length} />
        </div>

        {reports.length === 0 ? (
          <div className="text-xs opacity-70">Brak raportów dziennych dla tego zadania.</div>
        ) : (
          <div className="space-y-2">
            {reports.map((r) => {
              const tone = r.isCompleted ? "emerald" : "amber";
              const label = r.isCompleted ? "raport kończący" : "raport w toku";

              return (
                <Link
                  key={r.id}
                  href={`/daily-reports/${r.id}`}
                  className={[
                    "block rounded-xl border border-border bg-background/20 px-3 py-2",
                    "hover:bg-background/35 hover:border-border/90 transition",
                    "focus:outline-none focus:ring-2 focus:ring-foreground/40",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{r.date}</div>
                      <div className="text-[11px] opacity-70 truncate">
                        Osoba: {r.person ?? "—"}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Badge tone={tone}>{label}</Badge>
                      <span className="text-sm opacity-70">→</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
