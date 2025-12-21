// src/app/(app)/reports/materials-changes/[id]/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import BackButton from "@/components/BackButton";
import { fetchMaterialsChangeDetails } from "@/lib/queries/materialsChanges";

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

function prettyValue(v: string | null | undefined) {
  const s = String(v ?? "").trim();
  return s.length ? s : "—";
}

function StatPill({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <span className="text-[11px] px-2 py-1 rounded bg-background/60 border border-border">
      <span className="opacity-70">{label}:</span>{" "}
      <span className="font-semibold opacity-100">{value}</span>
    </span>
  );
}

function FilterPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] px-2 py-1 rounded bg-background/40 border border-border text-foreground/80">
      {children}
    </span>
  );
}

function ValueBox({
  title,
  value,
  tone = "neutral",
}: {
  title: string;
  value: string | null | undefined;
  tone?: "neutral" | "old" | "new";
}) {
  const boxTone =
    tone === "old"
      ? "bg-red-500/5 border-red-500/20"
      : tone === "new"
      ? "bg-emerald-500/5 border-emerald-500/20"
      : "bg-background/30 border-border";

  return (
    <div className={`rounded-xl border p-3 ${boxTone}`}>
      <div className="text-[11px] opacity-70">{title}</div>
      <div className="mt-1 text-sm font-medium break-words leading-relaxed">
        {prettyValue(value)}
      </div>
    </div>
  );
}

export default async function MaterialsChangeDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { canRead, row, batch } = await fetchMaterialsChangeDetails(id);
  if (!canRead) redirect("/");

  if (!row) {
    return (
      <main className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-sm font-medium">Zmiany materiałów</h1>
            <p className="text-xs opacity-70">Szczegóły wpisu zmiany.</p>
          </div>
          <BackButton className="px-3 py-2 rounded border border-border bg-card hover:bg-card/80 text-xs transition" />
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="text-sm text-foreground/80">Nie znaleziono wpisu.</div>
        </div>
      </main>
    );
  }

  const materialTitle = row.material_title ?? "—";
  const changedBy = row.changed_by_name ?? "—";
  const changedAt = fmtDateTime(row.changed_at);

  // batch -> field map
  const byField = new Map<string, { oldV: string | null; newV: string | null }>();
  for (const b of batch) {
    byField.set(b.field, { oldV: b.old_value ?? null, newV: b.new_value ?? null });
  }

  // kolejność “ludzka”
  const ORDER = ["title", "description", "unit", "current_quantity", "base_quantity"];
  const fields = ORDER.filter((f) => byField.has(f)).concat(
    Array.from(byField.keys()).filter((f) => !ORDER.includes(f))
  );

  return (
    <main className="p-6 space-y-4">
      {/* HEADER (KANON) */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-sm font-medium">Zmiany materiałów</h1>
          <p className="text-xs opacity-70">
            Wartości <span className="font-medium">przed</span> i{" "}
            <span className="font-medium">po</span> dla pól zmienionych w tej akcji.
          </p>
        </div>

        <BackButton className="px-3 py-2 rounded border border-border bg-card hover:bg-card/80 text-xs transition" />
      </div>

      {/* META BAR */}
      <div className="rounded-2xl border border-border bg-card p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatPill label="Materiał" value={materialTitle} />
            <StatPill label="Kto" value={changedBy} />
            <StatPill label="Kiedy" value={changedAt} />
            <StatPill label="Pól" value={fields.length} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <FilterPill>
              ID: <span className="font-mono">{String(row.id).slice(0, 8)}</span>
            </FilterPill>
          </div>
        </div>
      </div>

      {/* LINK DO MATERIAŁU */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs opacity-70">
            Chcesz zobaczyć aktualny stan materiału?
          </div>
          <Link
            href={`/materials/${row.material_id}`}
            className="inline-flex items-center justify-center rounded-xl border border-border bg-background px-3 py-2 text-xs hover:bg-background/80 transition"
            title={materialTitle}
          >
            Otwórz materiał →
          </Link>
        </div>
      </div>

      {/* ZMIANY */}
      {fields.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-4 text-sm opacity-70">
          Brak pól do wyświetlenia (pusta paczka zmian).
        </div>
      ) : (
        <div className="space-y-2">
          {fields.map((f) => {
            const v = byField.get(f);
            if (!v) return null;

            return (
              <div
                key={f}
                className={[
                  "rounded-2xl border border-border bg-card px-4 py-3",
                  "transition will-change-transform hover:bg-card/80 hover:border-border/80 active:scale-[0.995]",
                  "focus:outline-none focus:ring-2 focus:ring-foreground/40",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{fieldLabel(f)}</div>
                    <div className="text-[11px] opacity-70 font-mono">{f}</div>
                  </div>

                  <span className="text-[11px] px-2 py-1 rounded bg-background/60 border border-border">
                    zmiana
                  </span>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <ValueBox title="Stara wartość" value={v.oldV} tone="old" />
                  <ValueBox title="Nowa wartość" value={v.newV} tone="new" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CTA FOOTER */}
      <div className="rounded-2xl border border-border bg-card p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="text-xs opacity-70">
          Jeśli coś się nie zgadza — wróć do listy zmian i sprawdź zakres dat / filtr.
        </div>
        <Link
          href="/reports/materials-changes"
          className="rounded-xl border border-border bg-background px-3 py-2 text-xs hover:bg-background/80 transition inline-flex items-center justify-center"
        >
          Wróć do listy →
        </Link>
      </div>
    </main>
  );
}
