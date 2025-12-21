// src/app/(app)/reports/stage/page.tsx
import Link from "next/link";
import { fetchTasksForStageReport } from "@/lib/queries/stageReports";

import { getPermissionSnapshot } from "@/lib/currentUser";
import { can, PERM } from "@/lib/permissions";

type SearchParams = {
  q?: string;
};

/* ------------------------------ HELPERY ------------------------------ */

function normalizeSpaces(s: string) {
  return String(s || "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitPath(raw: string) {
  const s = normalizeSpaces(raw);
  if (!s) return [];

  // wspieramy kilka separatorów, bo nie wiemy jak DB formatuje subPlaceName
  const parts = s
    .split(/(?:\/|›|»|>|→|⟶|\\|\||:)\s*/g)
    .map((p) => normalizeSpaces(p))
    .filter(Boolean);

  return parts.length ? parts : [s];
}

/**
 * HEADER “podmiejsca”:
 * - w nawiasie ZAWSZE root (główne miejsce, pierwsze stworzone)
 * - przed "/" ZAWSZE segment przedostatni (jeśli istnieje)
 * - po "/" ZAWSZE segment ostatni
 * - jeśli głęboko -> wstawiamy "…"
 */
function makeSubPlaceHeader(rootPlaceName: string, subPlaceName: string | null) {
  const root = normalizeSpaces(rootPlaceName || "Brak miejsca");
  const sub = normalizeSpaces(subPlaceName || "");

  // brak podmiejsca -> sama informacja o root (ale bez ścieżki)
  if (!sub) {
    return {
      title: `(${root})`,
      note: null as string | null,
    };
  }

  const segs = splitPath(sub);

  // czasem sub zawiera root na początku — nie dublujemy
  const cleaned = segs.filter((x) => x.toLowerCase() !== root.toLowerCase());

  if (cleaned.length === 0) {
    return { title: `(${root})`, note: null as string | null };
  }

  const last = cleaned[cleaned.length - 1];
  const prev = cleaned.length >= 2 ? cleaned[cleaned.length - 2] : null;

  // zawsze chcemy format “… prev / last” (gdy prev istnieje), inaczej “… / last”
  const mid = prev ? `… ${prev} / ${last}` : `… / ${last}`;

  return {
    title: `(${root}) ${mid}`,
    note: cleaned.length >= 3 ? `Poziomów: ${cleaned.length}` : null,
  };
}

function statusChip(status: string) {
  if (status === "done") {
    return {
      text: "ZAKOŃCZONE",
      className:
        "bg-emerald-600/20 text-emerald-300 border border-emerald-500/40",
    };
  }
  if (status === "in_progress") {
    return {
      text: "W TOKU",
      className:
        "bg-amber-600/20 text-amber-300 border border-amber-500/40",
    };
  }
  return {
    text: "DO ZROBIENIA",
    className: "bg-zinc-600/20 text-zinc-300 border border-zinc-500/40",
  };
}

export default async function ProjectStageReportPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  // ✅ GATE — każdy poza workerem
  const snap = await getPermissionSnapshot();
  if (!can(snap, PERM.REPORTS_STAGES_READ)) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="text-sm text-foreground/80">Brak dostępu.</div>
      </div>
    );
  }

  const q = (searchParams?.q ?? "").trim().toLowerCase();
  const rows = await fetchTasksForStageReport();

  /**
   * Struktura:
   * root (główne miejsce) -> subKey (podmiejsca / ścieżki) -> tasks
   */
  const rootMap = new Map<
    string,
    {
      rootPlaceId: string | null;
      rootPlaceName: string;
      bySub: Map<string, typeof rows>;
    }
  >();

  for (const row of rows) {
    const rootKey = row.rootPlaceId ?? "__no_place__";

    if (!rootMap.has(rootKey)) {
      rootMap.set(rootKey, {
        rootPlaceId: row.rootPlaceId,
        rootPlaceName: row.rootPlaceName,
        bySub: new Map(),
      });
    }

    const g = rootMap.get(rootKey)!;
    const subKey = normalizeSpaces(row.subPlaceName ?? "__root__") || "__root__";

    if (!g.bySub.has(subKey)) g.bySub.set(subKey, []);
    g.bySub.get(subKey)!.push(row);
  }

  // sort root po nazwie
  let roots = Array.from(rootMap.values()).sort((a, b) =>
    a.rootPlaceName.localeCompare(b.rootPlaceName, "pl", { sensitivity: "base" })
  );

  // filtr q (po root, sub, title)
  if (q) {
    roots = roots
      .map((g) => {
        const nextBySub = new Map<string, typeof rows>();

        for (const [subKey, tasks] of g.bySub.entries()) {
          const filtered = tasks.filter((t) => {
            const placeText = `${g.rootPlaceName} ${subKey}`.toLowerCase();
            const titleText = String(t.title || "").toLowerCase();
            return placeText.includes(q) || titleText.includes(q);
          });
          if (filtered.length > 0) nextBySub.set(subKey, filtered);
        }

        return { ...g, bySub: nextBySub };
      })
      .filter((g) => {
        for (const tasks of g.bySub.values()) {
          if (tasks.length > 0) return true;
        }
        return false;
      });
  }

  const cardsCount = roots.reduce((acc, g) => acc + g.bySub.size, 0);
  const tasksCount = roots.reduce((acc, g) => {
    let n = 0;
    for (const tasks of g.bySub.values()) n += tasks.length;
    return acc + n;
  }, 0);

  const hasAny = tasksCount > 0;

  return (
    <div className="space-y-4">
      {/* HEADER (kanon) */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-sm font-medium">Etap projektu</h1>
          <p className="text-xs opacity-70">
            Każde główne miejsce to osobna tabela. Podmiejsca pokazujemy skrótem
            ścieżki: <span className="font-semibold">(główne)</span> …{" "}
            <span className="font-semibold">przedostatnie / konkretne</span>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] px-2 py-1 rounded bg-background/60 border border-border">
            Miejsc: <span className="font-semibold">{cardsCount}</span>
          </span>
          <span className="text-[11px] px-2 py-1 rounded bg-background/60 border border-border">
            Zadań: <span className="font-semibold">{tasksCount}</span>
          </span>
        </div>
      </div>

      {/* WYSZUKIWARKA (kanon) */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Szukaj</div>
            <div className="text-xs opacity-70">
              Po miejscu lub tytule zadania (działa po enterze).
            </div>
          </div>

          {q ? (
            <span className="text-[11px] px-2 py-1 rounded bg-background/60 border border-border">
              Fraza: <span className="font-semibold">„{q}”</span>
            </span>
          ) : (
            <span className="text-[11px] px-2 py-1 rounded bg-background/60 border border-border">
              Widok: <span className="font-semibold">wszystkie</span>
            </span>
          )}
        </div>

        <form className="max-w-xl">
          <input
            type="text"
            name="q"
            placeholder="Szukaj po miejscu lub tytule zadania…"
            defaultValue={searchParams?.q ?? ""}
            className="h-10 w-full rounded border border-border bg-background px-3 text-sm"
          />
          <div className="text-[11px] opacity-70 pt-2">
            Tip: szukaj po “rozdzielnia”, “magazyn”, “pokój”, “drzwi”, itp.
          </div>
        </form>
      </div>

      {!hasAny && (
        <div className="rounded-2xl border border-border bg-card p-4 text-sm opacity-70">
          Brak zadań do wyświetlenia w raporcie etapu projektu.
        </div>
      )}

      {/* ROOT TABLES */}
      {hasAny && (
        <div className="space-y-4">
          {roots.map((root) => {
            // sub sort: __root__ pierwsze, reszta po nazwie
            const subGroups = Array.from(root.bySub.entries()).sort(([a], [b]) => {
              if (a === "__root__") return -1;
              if (b === "__root__") return 1;
              return a.localeCompare(b, "pl", { sensitivity: "base" });
            });

            // ile zadań w tym root
            const rootTasksCount = subGroups.reduce((acc, [, tasks]) => acc + tasks.length, 0);

            return (
              <section
                key={root.rootPlaceId ?? "no-place"}
                className="rounded-2xl border border-border bg-card overflow-hidden"
              >
                {/* ROOT HEADER — mocniej wyróżniony */}
                <div className="p-4 border-b border-border/70 bg-background/20">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-lg font-semibold truncate">
                        {root.rootPlaceName}
                      </div>
                      <div className="text-xs opacity-70">
                        Główne miejsce • {rootTasksCount}{" "}
                        {rootTasksCount === 1 ? "zadanie" : "zadań"}
                      </div>
                    </div>

                    <span className="text-[11px] px-2 py-1 rounded bg-background/60 border border-border">
                      tabela
                    </span>
                  </div>
                </div>

                {/* BODY: podmiejsca (karty w tabeli) */}
                <div className="p-4 space-y-3">
                  {subGroups.map(([subKey, tasks]) => {
                    if (!tasks || tasks.length === 0) return null;

                    const isRootSub = subKey === "__root__";
                    const { title, note } = makeSubPlaceHeader(
                      root.rootPlaceName,
                      isRootSub ? null : subKey
                    );

                    return (
                      <div
                        key={`${root.rootPlaceId ?? "no-place"}::${subKey}`}
                        className="rounded-2xl border border-border bg-background/10 p-4 space-y-3"
                      >
                        {/* SUB HEADER */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-base font-semibold truncate">
                              {title}
                            </div>
                            <div className="text-xs opacity-70">
                              {tasks.length} {tasks.length === 1 ? "zadanie" : "zadań"}
                              {note ? <span className="ml-2 opacity-70">• {note}</span> : null}
                            </div>
                          </div>

                          <span className="text-[11px] px-2 py-1 rounded bg-background/60 border border-border">
                            lista
                          </span>
                        </div>

                        {/* TASKS: każdy jako osobny klikalny byt */}
                        <div className="space-y-2">
                          {tasks.map((task) => {
                            const isDone = task.status === "done";
                            const href = isDone
                              ? `/reports/tasks/${task.id}`
                              : `/tasks/${task.id}`;

                            const chip = statusChip(task.status);

                            return (
                              <Link
                                key={task.id}
                                href={href}
                                className={[
                                  "block rounded-xl border border-border bg-background/20 px-3 py-2",
                                  "hover:bg-background/35 hover:border-border/90 transition",
                                  "focus:outline-none focus:ring-2 focus:ring-foreground/40",
                                ].join(" ")}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="text-sm font-medium truncate">
                                      {task.title}
                                    </div>
                                    <div className="text-[11px] opacity-70">
                                      {isDone
                                        ? "Wejście do raportu zadania"
                                        : "Wejście do zadania"}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    <span
                                      className={`text-[11px] px-2 py-1 rounded ${chip.className}`}
                                    >
                                      {chip.text}
                                    </span>
                                    <span className="text-sm opacity-70">→</span>
                                  </div>
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
