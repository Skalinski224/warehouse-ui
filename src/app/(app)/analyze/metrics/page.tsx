// src/app/(app)/analyze/metrics/page.tsx
// Server Component — Analizy / Metryki (Mission Control)

import { redirect } from "next/navigation";

import MetricsLayout from "./_components/MetricsLayout";
import ProjectOverviewView from "./_views/ProjectOverviewView";

import { getProjectMetricsDash } from "@/lib/queries/metrics";
import { EMPTY_PROJECT_METRICS_DASH } from "@/lib/dto/metrics";

import { getPermissionSnapshot } from "@/lib/currentUser";
import { PERM, can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type ViewKey =
  | "project"
  | "plan-vs-reality"
  | "usage"
  | "anomalies"
  | "inventory-health"
  | "deliveries-control";

type SearchParams = Record<string, string | string[] | undefined>;

function pickFirst(v: string | string[] | undefined): string | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function isISODate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function normalizeDateParam(v: string | null): string | null {
  if (!v) return null;
  const s = v.trim();
  if (!isISODate(s)) return null;

  const [y, m, d] = s.split("-").map((x) => Number(x));
  const dt = new Date(Date.UTC(y, m - 1, d));
  const ok =
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d;

  return ok ? s : null;
}

function normalizeView(v: string | null): ViewKey {
  const raw = (v ?? "").trim();
  const allowed: ViewKey[] = [
    "project",
    "plan-vs-reality",
    "usage",
    "anomalies",
    "inventory-health",
    "deliveries-control",
  ];
  return (allowed.includes(raw as ViewKey) ? raw : "project") as ViewKey;
}

function swapIfNeeded(
  from: string | null,
  to: string | null
): [string | null, string | null] {
  if (!from || !to) return [from, to];
  return from <= to ? [from, to] : [to, from];
}

export default async function Page({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  // ✅ Źródło prawdy: snapshot z DB
  const snap = await getPermissionSnapshot();

  // brak snapshotu / brak wybranego konta
  if (!snap || !snap.account_id) {
    redirect("/");
  }

  // 🔒 Dostęp do Analiz: METRICS_READ (lub METRICS_MANAGE jako “mocniejsze”)
  const hasAccess =
    can(snap, PERM.METRICS_READ) || can(snap, PERM.METRICS_MANAGE);

  if (!hasAccess) {
    redirect("/");
  }

  const sp = searchParams ?? {};

  const view = normalizeView(pickFirst(sp.view));
  const from = normalizeDateParam(pickFirst(sp.from));
  const to = normalizeDateParam(pickFirst(sp.to));
  const place = (pickFirst(sp.place)?.trim() || null) ?? null;

  const [fromSafe, toSafe] = swapIfNeeded(from, to);

  // backend tylko dla "project" (na razie)
  let projectDash = EMPTY_PROJECT_METRICS_DASH;

  if (view === "project") {
    projectDash = await getProjectMetricsDash({
      from: fromSafe,
      to: toSafe,
      place,
    });
  }

  return (
    <MetricsLayout
      view={view}
      from={fromSafe}
      to={toSafe}
      place={place}
      title="Analizy"
      subtitle="Metryki projektu"
    >
      {view === "project" ? (
        <ProjectOverviewView
          from={fromSafe}
          to={toSafe}
          place={place}
          data={projectDash}
        />
      ) : view === "plan-vs-reality" ? (
        <div className="card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <h1 className="text-base font-semibold">
                Projekt vs Rzeczywistość
              </h1>
              <p className="text-xs text-muted-foreground">
                Widok w budowie — podepniemy dane z <span className="text-foreground">designer_vs_real_v2</span>.
              </p>
            </div>

            <div className="text-right text-[11px] text-muted-foreground">
              <div>
                Widok: <span className="text-foreground">{view}</span>
              </div>
              <div>
                Zakres:{" "}
                <span className="text-foreground">
                  {fromSafe ?? "—"} → {toSafe ?? "—"}
                </span>
              </div>
              <div>
                Miejsce: <span className="text-foreground">{place ?? "—"}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-border bg-card/40 p-3">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-yellow-500/70" />
              <p className="text-sm">
                Coming soon…{" "}
                <span className="text-xs text-muted-foreground">
                  (tu wlecą rodziny materiałów: plan vs real + odchylenia)
                </span>
              </p>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 rounded-xl border border-border bg-background/30"
                />
              ))}
            </div>

            <div className="mt-3 grid gap-2 lg:grid-cols-2">
              <div className="h-56 rounded-xl border border-border bg-background/30" />
              <div className="h-56 rounded-xl border border-border bg-background/30" />
            </div>

            <div className="mt-3 h-40 rounded-xl border border-border bg-background/30" />
          </div>
        </div>
      ) : (
        <div className="card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <h1 className="text-base font-semibold">Widok w budowie</h1>
              <p className="text-xs text-muted-foreground">
                Ten moduł jest już osadzony w shellu, ale backend + UI dla tego
                widoku dojdą w następnym kroku.
              </p>
            </div>

            <div className="text-right text-[11px] text-muted-foreground">
              <div>
                Widok: <span className="text-foreground">{view}</span>
              </div>
              <div>
                Zakres:{" "}
                <span className="text-foreground">
                  {fromSafe ?? "—"} → {toSafe ?? "—"}
                </span>
              </div>
              <div>
                Miejsce: <span className="text-foreground">{place ?? "—"}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-border bg-card/40 p-3">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-yellow-500/70" />
              <p className="text-sm">
                Coming soon…{" "}
                <span className="text-xs text-muted-foreground">
                  (kolejne zakładki dołożymy po tym jak „Projekt w liczbach”
                  będzie perfekcyjny)
                </span>
              </p>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 rounded-xl border border-border bg-background/30"
                />
              ))}
            </div>

            <div className="mt-3 grid gap-2 lg:grid-cols-2">
              <div className="h-56 rounded-xl border border-border bg-background/30" />
              <div className="h-56 rounded-xl border border-border bg-background/30" />
            </div>

            <div className="mt-3 h-40 rounded-xl border border-border bg-background/30" />
          </div>
        </div>
      )}
    </MetricsLayout>
  );
}
