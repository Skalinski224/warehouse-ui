// src/app/(app)/reports/materials-changes/_components/MaterialsChangesClient.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Row = {
  id: string;
  material_title: string | null;
  changed_at: string;
  changed_by_name: string | null;
  fields: string[] | null;
};

type Props = {
  initialRows: Row[];
  initialParams: { q: string; from: string; to: string; page: number };
  limit: number;
};

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pl-PL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fieldLabel(field: string) {
  switch (field) {
    case "title":
      return "Tytuł";
    case "description":
      return "Opis";
    case "unit":
      return "Jednostka";
    case "base_quantity":
      return "Ilość bazowa";
    case "current_quantity":
      return "Ilość aktualna";
    default:
      return field;
  }
}

function Chip({ label }: { label: string }) {
  return (
    <span className="text-[11px] px-2 py-1 rounded border border-border bg-background/40 text-foreground/80">
      {label}
    </span>
  );
}

function StatPill({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="text-[11px] px-2 py-1 rounded bg-background/60 border border-border">
      <span className="opacity-70">{label}:</span>{" "}
      <span className="font-semibold opacity-100">{value}</span>
    </div>
  );
}

function mkUrl(params: { q: string; from: string; to: string; page: number }) {
  const p = new URLSearchParams();
  if (params.q.trim()) p.set("q", params.q.trim());
  if (params.from.trim()) p.set("from", params.from.trim());
  if (params.to.trim()) p.set("to", params.to.trim());
  p.set("page", String(params.page));
  return `/reports/materials-changes?${p.toString()}`;
}

async function fetchJson(params: {
  q: string;
  from: string;
  to: string;
  page: number;
  limit: number;
}) {
  const p = new URLSearchParams();
  if (params.q.trim()) p.set("q", params.q.trim());
  if (params.from.trim()) p.set("from", params.from.trim());
  if (params.to.trim()) p.set("to", params.to.trim());
  p.set("page", String(params.page));
  p.set("limit", String(params.limit));

  const res = await fetch(`/api/reports/materials-changes?${p.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return {
      ok: false as const,
      rows: [] as Row[],
      error: t || `HTTP ${res.status}`,
    };
  }

  const json = (await res.json()) as { rows: Row[] };
  return { ok: true as const, rows: json.rows ?? [], error: null as string | null };
}

export default function MaterialsChangesClient({
  initialRows,
  initialParams,
  limit,
}: Props) {
  const router = useRouter();

  const [q, setQ] = useState(initialParams.q);
  const [from, setFrom] = useState(initialParams.from);
  const [to, setTo] = useState(initialParams.to);
  const [page, setPage] = useState(initialParams.page);

  const [rows, setRows] = useState<Row[]>(initialRows);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const debounceRef = useRef<number | null>(null);
  const lastKeyRef = useRef<string>("");

  useEffect(() => {
    const key = JSON.stringify({ q, from, to, page });
    if (lastKeyRef.current === key) return;

    if (debounceRef.current) window.clearTimeout(debounceRef.current);

    debounceRef.current = window.setTimeout(async () => {
      lastKeyRef.current = key;

      router.replace(mkUrl({ q, from, to, page }), { scroll: false });

      setLoading(true);
      const res = await fetchJson({ q, from, to, page, limit });
      setRows(res.rows);
      setLoadError(res.ok ? null : res.error);
      setLoading(false);
    }, 300);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [q, from, to, page, limit, router]);

  const setQLive = (v: string) => {
    setPage(1);
    setQ(v);
  };
  const setFromLive = (v: string) => {
    setPage(1);
    setFrom(v);
  };
  const setToLive = (v: string) => {
    setPage(1);
    setTo(v);
  };

  const canPrev = page > 1;
  const canNext = rows.length >= limit;

  const infoText = useMemo(() => {
    if (loading) return "Ładuję…";
    return `Wyników na stronie: ${rows.length}`;
  }, [loading, rows.length]);

  return (
    <div className="space-y-3">
      {/* FILTRY (KANON) */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="grid gap-3 md:grid-cols-6">
          <label className="flex flex-col gap-1">
            <span className="opacity-70 text-xs">Od</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFromLive(e.target.value)}
              className="w-full rounded border border-border bg-background px-2 py-2 text-sm"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="opacity-70 text-xs">Do</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setToLive(e.target.value)}
              className="w-full rounded border border-border bg-background px-2 py-2 text-sm"
            />
          </label>

          <label className="flex flex-col gap-1 md:col-span-4">
            <span className="opacity-70 text-xs">Szukaj (materiał / osoba)</span>
            <input
              type="text"
              value={q}
              onChange={(e) => setQLive(e.target.value)}
              placeholder="Wpisz frazę…"
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
            />
          </label>

          <div className="md:col-span-6 flex items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatPill label="Info" value={infoText} />
              <StatPill label="Limit" value={limit} />
              <StatPill label="Strona" value={page} />
            </div>

            <button
              type="button"
              onClick={() => {
                setQ("");
                setFrom("");
                setTo("");
                setPage(1);
              }}
              className="px-3 py-2 rounded border border-border bg-background text-xs hover:bg-background/80 transition"
            >
              Wyczyść
            </button>
          </div>
        </div>
      </section>

      {/* ERROR */}
      {loadError && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
          Błąd ładowania: {loadError}
        </div>
      )}

      {/* LISTA (ODERWANE KARTY-BUTTONY) */}
      <section className="space-y-2">
        {rows.length === 0 && !loading && !loadError && (
          <div className="rounded-2xl border border-border bg-card p-4 text-sm opacity-70">
            Brak wyników – zmień zakres dat lub frazę.
          </div>
        )}

        {rows.map((a) => {
          const labels = (a.fields ?? []).map(fieldLabel);
          const maxChips = 3;
          const chips = labels.slice(0, maxChips);
          const rest = labels.length - chips.length;

          const who = a.changed_by_name?.trim() ? a.changed_by_name : "—";
          const when = fmtDateTime(a.changed_at);

          return (
            <Link
              key={a.id}
              href={`/reports/materials-changes/${a.id}`}
              className={[
                "rounded-2xl border border-border bg-card px-4 py-3 block",
                "transition will-change-transform hover:bg-card/80 hover:border-border/80 active:scale-[0.995]",
                "focus:outline-none focus:ring-2 focus:ring-foreground/40",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-2">
                  {/* TITLE */}
                  <div className="text-sm font-medium truncate">
                    {a.material_title ?? "—"}
                  </div>

                  {/* META (KTO/KIEDY) */}
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="px-2 py-0.5 rounded border border-border bg-background/40 opacity-80">
                      KTO
                    </span>
                    <span className="font-semibold">{who}</span>

                    <span className="opacity-40">•</span>

                    <span className="px-2 py-0.5 rounded border border-border bg-background/40 opacity-80">
                      KIEDY
                    </span>
                    <span className="font-semibold">{when}</span>
                  </div>

                  {/* FIELDS */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-xs opacity-70">Zmieniono:</span>
                    {chips.map((c) => (
                      <Chip key={c} label={c} />
                    ))}
                    {rest > 0 ? <Chip label={`+${rest}`} /> : null}
                  </div>
                </div>

                {/* CTA */}
                <div className="shrink-0">
                  <span className="px-3 py-2 rounded border border-border bg-background text-xs hover:bg-background/80 transition">
                    Szczegóły →
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </section>

      {/* PAGER (KANON) */}
      <footer className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={() => canPrev && setPage((p) => Math.max(1, p - 1))}
          className={[
            "px-3 py-2 rounded border border-border bg-card text-xs transition",
            "hover:bg-card/80 active:scale-[0.98] will-change-transform",
            canPrev ? "" : "pointer-events-none opacity-50",
          ].join(" ")}
          aria-disabled={!canPrev}
        >
          ← Poprzednia
        </button>

        <div className="text-xs opacity-70">Strona {page}</div>

        <button
          type="button"
          onClick={() => canNext && setPage((p) => p + 1)}
          className={[
            "px-3 py-2 rounded border border-border bg-card text-xs transition",
            "hover:bg-card/80 active:scale-[0.98] will-change-transform",
            canNext ? "" : "pointer-events-none opacity-50",
          ].join(" ")}
          aria-disabled={!canNext}
        >
          Następna →
        </button>
      </footer>
    </div>
  );
}
