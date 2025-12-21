// src/app/(app)/analyze/metrics/_components/MetricsTabs.tsx
// Client — lewy panel nawigacji (tabs)
// - większość zakładek sterowana URL param: ?view=...
// - "Projekt vs Rzeczywistość" na razie prowadzi do osobnej strony: /analyze/plan-vs-reality

"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

type ViewKey =
  | "project"
  | "usage"
  | "anomalies"
  | "inventory-health"
  | "deliveries-control";

type Tab =
  | {
      kind: "internal";
      key: ViewKey;
      label: string;
      desc: string;
      icon: string;
    }
  | {
      kind: "route";
      href: string;
      label: string;
      desc: string;
      icon: string;
    };

const TABS: Tab[] = [
  {
    kind: "internal",
    key: "project",
    label: "Projekt w liczbach",
    desc: "Werdykt + dlaczego",
    icon: "🛰️",
  },

  // ✅ NOWE: na razie osobna strona/route
  {
    kind: "route",
    href: "/analyze/plan-vs-reality",
    label: "Projekt vs Rzeczywistość",
    desc: "Plan vs real (rodziny materiałów)",
    icon: "📐",
  },

  {
    kind: "internal",
    key: "usage",
    label: "Top zużycia",
    desc: "Co i kto pali budżet",
    icon: "🔥",
  },
  {
    kind: "internal",
    key: "anomalies",
    label: "Anomalie",
    desc: "Rozjazdy i alerty",
    icon: "🚨",
  },
  {
    kind: "internal",
    key: "inventory-health",
    label: "Zdrowie magazynu",
    desc: "Czy jutro stanie budowa",
    icon: "🧯",
  },
  {
    kind: "internal",
    key: "deliveries-control",
    label: "Dostawy – kontrola",
    desc: "Wąskie gardła dostaw",
    icon: "🚚",
  },
];

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

function buildHref(params: URLSearchParams, view: ViewKey) {
  const next = new URLSearchParams(params);
  next.set("view", view);

  // porządki: jeśli ktoś ma pusty place/from/to — nie taszczymy śmieci
  for (const k of ["from", "to", "place"]) {
    const v = next.get(k);
    if (!v || !v.trim()) next.delete(k);
  }

  return `?${next.toString()}`;
}

export default function MetricsTabs({ activeView }: { activeView: ViewKey }) {
  const sp = useSearchParams();
  const current = new URLSearchParams(sp?.toString() ?? "");

  return (
    <nav className="space-y-2">
      {TABS.map((t) => {
        const isActive =
          t.kind === "internal" ? t.key === activeView : false;

        const href =
          t.kind === "internal"
            ? buildHref(current, t.key)
            : t.href;

        return (
          <Link
            key={t.kind === "internal" ? t.key : t.href}
            href={href}
            scroll={false}
            className={cx(
              "group block rounded-2xl border px-3 py-2 transition",
              "focus:outline-none focus:ring-2 focus:ring-ring/40",
              isActive
                ? "border-border bg-background/50 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]"
                : "border-border bg-card/40 hover:bg-card/60"
            )}
            aria-current={isActive ? "page" : undefined}
            title={t.desc}
          >
            <div className="flex items-center gap-3">
              <div
                className={cx(
                  "grid h-9 w-9 place-items-center rounded-xl border text-sm",
                  isActive
                    ? "border-border bg-background/40"
                    : "border-border bg-background/20 group-hover:bg-background/30"
                )}
              >
                <span aria-hidden>{t.icon}</span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p
                    className={cx(
                      "truncate text-sm font-medium",
                      isActive ? "text-foreground" : "text-foreground/90"
                    )}
                  >
                    {t.label}
                  </p>

                  {isActive ? (
                    <span className="inline-flex items-center rounded-full border border-border bg-background/40 px-2 py-0.5 text-[10px] text-muted-foreground">
                      ACTIVE
                    </span>
                  ) : (
                    <span className="opacity-0 transition group-hover:opacity-100 text-[10px] text-muted-foreground">
                      open →
                    </span>
                  )}
                </div>

                <p className="truncate text-xs text-muted-foreground">
                  {t.desc}
                </p>
              </div>
            </div>

            {/* “Kosmiczny” akcent: subtelna linia sygnału */}
            <div className="mt-2 h-[2px] w-full overflow-hidden rounded-full bg-border">
              <div
                className={cx(
                  "h-full rounded-full transition-all",
                  isActive
                    ? "w-3/4 bg-foreground/30"
                    : "w-1/4 bg-foreground/15 group-hover:w-1/2"
                )}
              />
            </div>
          </Link>
        );
      })}

      <div className="mt-3 rounded-2xl border border-border bg-background/20 p-3">
        <p className="text-[11px] text-muted-foreground">
          Tip: ustaw filtry, skopiuj URL i wyślij — druga osoba zobaczy dokładnie
          ten sam widok.
        </p>
      </div>
    </nav>
  );
}
