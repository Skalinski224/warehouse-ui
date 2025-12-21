// src/app/(app)/reports/inventory/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";

import BackButton from "@/components/BackButton";
import { supabaseServer } from "@/lib/supabaseServer";
import { getInventorySessionDetails } from "@/lib/queries/inventory";
import { getPermissionSnapshot } from "@/lib/currentUser";
import { can, PERM } from "@/lib/permissions";

type Params = Promise<{ id: string }>;

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
      {children}
    </span>
  );
}

function Tile({
  title,
  children,
  alignRight = false,
}: {
  title?: string;
  children: React.ReactNode;
  alignRight?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-xl border border-border bg-card px-4 py-3",
        "min-h-[64px] flex flex-col justify-center",
        alignRight ? "items-end text-right" : "items-start text-left",
      ].join(" ")}
    >
      {title ? (
        <div className="text-[11px] text-muted-foreground">{title}</div>
      ) : null}
      <div className="mt-1 text-sm text-foreground min-w-0">{children}</div>
    </div>
  );
}

function fmtUnit(unit: string | null) {
  return unit?.trim() ? ` ${unit.trim()}` : "";
}

function DiffPill({ diff }: { diff: number | null }) {
  if (diff === null) {
    return (
      <span className="inline-flex items-center rounded-md border border-border bg-card px-2 py-1 text-[11px] text-muted-foreground">
        —
      </span>
    );
  }

  if (diff === 0) {
    return (
      <span className="inline-flex items-center rounded-md border border-border bg-card px-2 py-1 text-[11px] text-muted-foreground">
        0
      </span>
    );
  }

  const isMore = diff > 0;
  const label = isMore ? `+${diff}` : String(diff);

  return (
    <span className="inline-flex items-center rounded-md border border-border bg-card px-2 py-1 text-[11px] text-foreground">
      {label}
    </span>
  );
}

function Arrow({ diff }: { diff: number | null }) {
  // strzałka: neutral / green / red
  const cls =
    diff === null || diff === 0
      ? "text-muted-foreground"
      : diff > 0
      ? "text-emerald-400"
      : "text-red-400";

  return (
    <div className="flex h-full items-center justify-center">
      <span className={["select-none leading-none", cls, "text-4xl"].join(" ")}>
        →
      </span>
    </div>
  );
}

export default async function ReportInventoryDetailsPage({
  params,
}: {
  params: Params;
}) {
  // ✅ Gate: tylko owner / manager / storeman (permission)
  const snap = await getPermissionSnapshot();
  if (!can(snap, PERM.REPORTS_INVENTORY_READ)) {
    return (
      <main className="p-6">
        <div className="rounded-xl border border-border bg-card p-4 text-sm text-foreground/80">
          Brak dostępu.
        </div>
      </main>
    );
  }

  const { id } = await params;

  const { meta, items } = await getInventorySessionDetails(id);
  if (!meta) notFound();

  // person z overview
  const supabase = await supabaseServer();
  const { data: overview } = await supabase
    .from("v_inventory_sessions_overview")
    .select("person,first_name,last_name")
    .eq("id", meta.session_id)
    .limit(1)
    .maybeSingle();

  const person =
    (overview?.person && String(overview.person).trim()) ||
    [overview?.first_name, overview?.last_name].filter(Boolean).join(" ").trim() ||
    "—";

  if (!meta.approved) {
    return (
      <div className="space-y-4">
        <div className="card p-4 text-xs text-muted-foreground">
          Ta inwentaryzacja nie jest zatwierdzona (draft) i nie należy do raportów.
          <div className="mt-2">
            <Link className="underline" href={`/inventory/new?session=${meta.session_id}`}>
              Przejdź do draftu
            </Link>
          </div>
        </div>

        <BackButton />
      </div>
    );
  }

  const missingCount = items.filter((i) => i.counted_qty === null).length;
  const diffCount = items.filter(
    (i) => i.counted_qty !== null && i.counted_qty !== i.system_qty
  ).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold">Inwentaryzacja — szczegóły</h1>
            <span className="inline-flex items-center rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-400">
              Zatwierdzona
            </span>
          </div>
        </div>

        <BackButton />
      </div>

      {/* Meta */}
      <div className="card p-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge>
            Data: <span className="ml-1 text-foreground">{meta.session_date}</span>
          </Badge>
          <Badge>
            Kto: <span className="ml-1 text-foreground">{person}</span>
          </Badge>
          <Badge>
            Pozycje: <span className="ml-1 text-foreground">{items.length}</span>
          </Badge>
          <Badge>
            Braki: <span className="ml-1 text-foreground">{missingCount}</span>
          </Badge>
          <Badge>
            Zmiany: <span className="ml-1 text-foreground">{diffCount}</span>
          </Badge>
        </div>
      </div>

      {/* List */}
      {items.length === 0 ? (
        <div className="card p-4 text-xs text-muted-foreground">
          Brak pozycji w tej inwentaryzacji.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((i) => {
            const unit = i.material_unit ?? null;
            const diff =
              i.counted_qty !== null ? i.counted_qty - i.system_qty : null;

            const systemLabel = `${i.system_qty}${fmtUnit(unit)}`;
            const countedLabel =
              i.counted_qty === null ? "—" : `${i.counted_qty}${fmtUnit(unit)}`;

            return (
              <Link
                key={i.item_id}
                href={`/materials/${i.material_id}`}
                className={[
                  "block transition",
                  "focus:outline-none focus:ring-2 focus:ring-foreground/20",
                ].join(" ")}
              >
                {/* wrapper wiersza (hover delikatny) */}
                <div className="rounded-xl border border-border bg-transparent p-2 transition hover:bg-foreground/5 hover:border-foreground/20">
                  {/* Mobile: stack */}
                  <div className="grid gap-2 md:hidden">
                    <Tile title="Nazwa">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{i.material_title}</div>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          System: <span className="text-foreground">{systemLabel}</span>
                          <span className="mx-2">•</span>
                          Faktyczny:{" "}
                          <span className="text-foreground">{countedLabel}</span>
                        </div>
                      </div>
                    </Tile>

                    <div className="grid grid-cols-[1fr_56px_1fr] gap-2">
                      <Tile title="Stan przed inwentaryzacją">{systemLabel}</Tile>
                      <div className="rounded-xl border border-border bg-card px-2 py-3">
                        <Arrow diff={diff} />
                      </div>
                      <Tile title="Stan po inwentaryzacji">
                        {i.counted_qty === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          countedLabel
                        )}
                      </Tile>
                    </div>

                    <Tile title="Podsumowanie" alignRight>
                      <div className="flex items-center gap-2">
                        <DiffPill diff={diff} />
                        <span className="text-[11px] text-muted-foreground">
                          (kliknij → materiał)
                        </span>
                      </div>
                    </Tile>
                  </div>

                  {/* Desktop: kafelki jak na screenie */}
                  <div className="hidden md:grid md:grid-cols-[1.4fr_0.9fr_64px_0.9fr_0.8fr] md:items-stretch md:gap-2">
                    {/* nazwa */}
                    <Tile title="Nazwa">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{i.material_title}</div>
                      </div>
                    </Tile>

                    {/* stan przed */}
                    <Tile title="Stan przed inwentaryzacją">{systemLabel}</Tile>

                    {/* strzałka (zawsze środek, większa) */}
                    <div className="rounded-xl border border-border bg-card px-2 py-3">
                      <Arrow diff={diff} />
                    </div>

                    {/* stan po */}
                    <Tile title="Stan po inwentaryzacji">
                      {i.counted_qty === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        countedLabel
                      )}
                    </Tile>

                    {/* podsumowanie */}
                    <Tile title="Podsumowanie" alignRight>
                      <div className="flex items-center justify-end gap-2">
                        <DiffPill diff={diff} />
                      </div>
                    </Tile>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
