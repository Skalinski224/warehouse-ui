// src/app/(app)/materials/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import BackButton from "@/components/BackButton";
import { createMaterial, softDeleteMaterial } from "@/lib/actions";
import { fetchMaterials } from "@/lib/queries/materials";
import { fetchInventoryLocations } from "@/lib/queries/inventoryLocations";
import type { MaterialOverview } from "@/lib/dto";
import { supabaseServer } from "@/lib/supabaseServer";
import { PERM } from "@/lib/permissions";

import MaterialsSearchPanel from "@/app/(app)/materials/_components/MaterialsSearchPanel";
import AddMaterialModal from "@/app/(app)/materials/_components/AddMaterialModal";
import BulkDeleteConfirmButton from "@/app/(app)/materials/_components/BulkDeleteConfirmButton";

import { TransferModeProvider } from "@/app/(app)/materials/_components/TransferModeContext";
import MaterialsGridClient from "@/app/(app)/materials/_components/MaterialsGridClient";
import MaterialsActionsBarWithTransfer from "@/app/(app)/materials/_components/MaterialsActionsBarWithTransfer";

type SnapshotRow = { key: string; allowed: boolean };

function isNextRedirectError(e: unknown): boolean {
  const d = (e as any)?.digest;
  return typeof d === "string" && d.includes("NEXT_REDIRECT");
}

async function getPermSet() {
  const sb = await supabaseServer();
  const { data, error } = await sb.rpc("my_permissions_snapshot");
  if (error || !data) return new Set<string>();

  const obj = Array.isArray(data) ? (data[0] ?? null) : data;
  if (obj && typeof obj === "object") {
    const perms = (obj as any)?.permissions;
    if (Array.isArray(perms)) return new Set(perms.map((x) => String(x)));
  }

  if (Array.isArray(data)) {
    const rows: SnapshotRow[] = data as any;
    return new Set(
      rows
        .filter((r) => r?.allowed)
        .map((r) => String(r.key))
        .filter(Boolean)
    );
  }

  return new Set<string>();
}

function can(permSet: Set<string>, key: string) {
  return permSet.has(key);
}

async function addMaterial(formData: FormData) {
  "use server";

  const permSet = await getPermSet();
  if (!can(permSet, PERM.MATERIALS_WRITE)) return;

  const q = formData.get("q")?.toString().trim() || "";
  const sort = formData.get("sort")?.toString() || "title";
  const dir = formData.get("dir")?.toString() || "asc";
  const multi = formData.get("multi") === "1" ? "1" : "";
  const page = formData.get("page")?.toString() || "1";
  const loc = formData.get("loc")?.toString().trim() || "";
  const state = formData.get("state")?.toString() || "active";

  const p = new URLSearchParams();
  if (q) p.set("q", q);
  p.set("sort", sort);
  p.set("dir", dir);
  if (loc) p.set("loc", loc);
  if (state) p.set("state", state);
  if (multi) p.set("multi", multi);
  p.set("page", page);

  const selectedLoc = String(formData.get("inventory_location_id") || "").trim();
  const newLocLabel = String(formData.get("inventory_location_new_label") || "").trim();

  if (!selectedLoc) {
    p.set("toast", "Wybierz lokalizację.");
    p.set("tone", "err");
    p.set("add", "1");
    redirect(`/materials?${p.toString()}`);
  }

  if (selectedLoc === "__NEW__" && !newLocLabel) {
    p.set("toast", "Podaj nazwę nowej lokalizacji.");
    p.set("tone", "err");
    p.set("add", "1");
    redirect(`/materials?${p.toString()}`);
  }

  try {
    await createMaterial(formData);
    p.set("toast", "Materiał został dodany pomyślnie.");
    p.set("tone", "ok");
    redirect(`/materials?${p.toString()}`);
  } catch (e) {
    if (isNextRedirectError(e)) throw e;

    p.set("toast", "Nie udało się dodać materiału.");
    p.set("tone", "err");
    p.set("add", "1");
    redirect(`/materials?${p.toString()}`);
  }
}

async function bulkDeleteMaterials(formData: FormData) {
  "use server";

  const permSet = await getPermSet();
  if (!can(permSet, PERM.MATERIALS_SOFT_DELETE)) return;

  const ids = formData.getAll("ids") as string[];

  const q = formData.get("q")?.toString().trim() || "";
  const sort = formData.get("sort")?.toString() || "title";
  const dir = formData.get("dir")?.toString() || "asc";
  const loc = formData.get("loc")?.toString().trim() || "";
  const page = formData.get("page")?.toString() || "1";
  const state = "active";

  const p = new URLSearchParams();
  if (q) p.set("q", q);
  p.set("sort", sort);
  p.set("dir", dir);
  if (loc) p.set("loc", loc);
  p.set("state", state);
  p.set("page", page);

  if (!ids || ids.length === 0) {
    p.set("toast", "Nie wybrano żadnych materiałów.");
    p.set("tone", "err");
    redirect(`/materials?${p.toString()}`);
  }

  let ok = true;
  try {
    for (const id of ids) {
      if (typeof id === "string" && id.trim().length > 0) {
        await softDeleteMaterial(id);
      }
    }
  } catch {
    ok = false;
  }

  if (ok) {
    p.set("toast", "Materiały zostały usunięte poprawnie.");
    p.set("tone", "ok");
  } else {
    p.set("toast", "Nie udało się usunąć materiału.");
    p.set("tone", "err");
  }

  redirect(`/materials?${p.toString()}`);
}

function sp(searchParams: { [key: string]: string | string[] | undefined }, key: string) {
  const v = searchParams?.[key];
  return Array.isArray(v) ? v[0] : v;
}

const SORT_KEYS = ["title", "current_quantity", "base_quantity", "created_at"] as const;
type SortKey = (typeof SORT_KEYS)[number];
const DIRS = ["asc", "desc"] as const;
type Dir = (typeof DIRS)[number];

type RawSearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

function toNum(v: unknown) {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v) || 0;
  return 0;
}

export default async function MaterialsPage({ searchParams }: { searchParams: RawSearchParams }) {
  const spObj = await searchParams;

  const permSet = await getPermSet();
  if (!can(permSet, PERM.MATERIALS_READ)) redirect("/");

  const canWrite = can(permSet, PERM.MATERIALS_WRITE);
  const canSoftDelete = can(permSet, PERM.MATERIALS_SOFT_DELETE);

  const q = (sp(spObj, "q") ?? "").trim();

  const sortRaw = (sp(spObj, "sort") ?? "title") as SortKey;
  const sort: SortKey = (SORT_KEYS as readonly string[]).includes(sortRaw) ? sortRaw : "title";

  const dirRaw = (sp(spObj, "dir") ?? "asc") as Dir;
  const dir: Dir = (DIRS as readonly string[]).includes(dirRaw) ? dirRaw : "asc";

  const loc = (sp(spObj, "loc") ?? "").trim();

  const stateRaw = (sp(spObj, "state") ?? "active") as "active" | "deleted";
  const state: "active" | "deleted" = stateRaw === "deleted" && canSoftDelete ? "deleted" : "active";

  if (state === "deleted") {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    p.set("sort", sort);
    p.set("dir", dir);
    if (loc) p.set("loc", loc);
    p.set("page", "1");
    redirect(`/materials/deleted?${p.toString()}`);
  }

  const multi = canSoftDelete && sp(spObj, "multi") === "1";
  const add = canWrite && sp(spObj, "add") === "1";

  const page = Math.max(1, Number(sp(spObj, "page") ?? 1));
  const limit = 100;
  const offset = (page - 1) * limit;

  const rows: MaterialOverview[] = await fetchMaterials({
    q: q ? q : null,
    sort,
    dir,
    limit,
    offset,
    inventory_location_id: loc ? loc : null,
    state: "active",
  });

  const locations = await fetchInventoryLocations({ includeDeleted: false });

  const baseUrl = "/materials";
  const mkQuery = (overrides: Record<string, string | number | boolean | undefined>) => {
    const p = new URLSearchParams();
    const qFinal = typeof overrides.q === "string" ? overrides.q : q;
    if (qFinal?.trim()) p.set("q", qFinal.trim());

    p.set("sort", String(overrides.sort ?? sort));
    p.set("dir", String(overrides.dir ?? dir));

    const locFinal = typeof overrides.loc === "string" ? overrides.loc : loc;
    if (locFinal?.trim()) p.set("loc", locFinal.trim());

    const stateFinal = typeof overrides.state === "string" ? overrides.state : "active";
    p.set("state", String(stateFinal));

    const multiFinal =
      typeof overrides.multi === "boolean" || typeof overrides.multi === "number" ? Boolean(overrides.multi) : multi;
    if (multiFinal && canSoftDelete) p.set("multi", "1");

    const addFinal =
      typeof overrides.add === "boolean" || typeof overrides.add === "number" ? Boolean(overrides.add) : false;
    if (addFinal && canWrite) p.set("add", "1");

    p.set("page", String(overrides.page ?? page));
    return `${baseUrl}?${p.toString()}`;
  };

  const defaultLocationId = locations.find((x: any) => x.label === "Magazyn")?.id ?? locations[0]?.id ?? "";

  const prevHref = mkQuery({ page: Math.max(1, page - 1) });
  const nextHref = mkQuery({ page: page + 1 });
  const isLastPage = rows.length < limit;

  return (
    <TransferModeProvider
      locations={(locations ?? []).map((l: any) => ({ id: String(l.id), label: String(l.label) }))}
    >
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold">Katalog materiałów</h1>
          <BackButton className="card inline-flex items-center px-3 py-2 text-xs font-medium" />
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
          <MaterialsActionsBarWithTransfer
            canSoftDelete={canSoftDelete}
            canWrite={canWrite}
            addHref={mkQuery({ page: 1, add: true })}
            multi={multi}
            toggleMultiHref={mkQuery({ page: 1, multi: !multi })}
          />

          <div className="rounded-2xl border border-border bg-background/20 p-4">
            <MaterialsSearchPanel
              canSoftDelete={canSoftDelete}
              locations={(locations ?? []).map((l: any) => ({
                id: String(l.id),
                label: String(l.label),
              }))}
              initial={{
                q,
                sort,
                dir,
                loc,
                state: "active",
                page,
                multi: multi ? "1" : "",
              }}
            />
          </div>
        </div>

        <AddMaterialModal
          add={add}
          canWrite={canWrite}
          addMaterialAction={addMaterial}
          mkQuery={mkQuery}
          q={q}
          sort={sort}
          dir={dir}
          page={page}
          multi={multi}
          loc={loc}
          state={"active"}
          locations={locations}
          defaultLocationId={defaultLocationId}
        />

        {rows.length === 0 ? (
          <div className="border border-dashed border-border rounded p-8 text-center text-sm opacity-75">
            Brak wyników.
          </div>
        ) : multi && canSoftDelete ? (
          <form id="bulkDeleteForm" action={bulkDeleteMaterials} className="space-y-3">
            <input type="hidden" name="q" value={q} />
            <input type="hidden" name="sort" value={sort} />
            <input type="hidden" name="dir" value={dir} />
            <input type="hidden" name="loc" value={loc} />
            <input type="hidden" name="state" value="active" />
            <input type="hidden" name="page" value={String(page)} />

            <div className="flex justify-end">
              <BulkDeleteConfirmButton formId="bulkDeleteForm" countLabel="zaznaczone materiały" />
            </div>

            {/* multi grid bez zmian – używasz swojego starego renderu checkboxów */}
            <ul className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {rows.map((m: any) => {
                const base = toNum(m.base_quantity);
                const cur = toNum(m.current_quantity);
                const pct = base > 0 ? Math.round((cur / base) * 100) : 0;
                const locLabel = (m?.inventory_location_label as string | null | undefined) ?? "—";

                return (
                  <li
                    key={m.id}
                    className="rounded-2xl border border-border bg-card overflow-hidden relative transition hover:bg-background/10"
                  >
                    <label className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-background/80 px-2 py-1 rounded text-xs">
                      <input type="checkbox" name="ids" value={m.id} className="accent-red-500" />
                      <span>Zaznacz</span>
                    </label>

                    <div className="pointer-events-none">
                      <div className="p-4">
                        <div className="flex gap-4">
                          <div className="w-28 h-28 rounded-xl overflow-hidden bg-background/50 border border-border flex-shrink-0 relative">
                            {m.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={m.image_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-xs opacity-60">
                                brak zdjęcia
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="font-semibold truncate">{m.title}</div>
                                {m.description ? (
                                  <div className="mt-1 text-sm opacity-80 line-clamp-2">{m.description}</div>
                                ) : (
                                  <div className="mt-1 text-sm opacity-50 line-clamp-2">—</div>
                                )}
                              </div>

                              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                <span className="text-[11px] px-2 py-1 rounded bg-background/60 border border-border">
                                  {m.unit}
                                </span>

                                <span className="text-[10px] px-2 py-1 rounded border border-emerald-500/35 bg-emerald-500/10 text-emerald-300">
                                  {locLabel}
                                </span>
                              </div>
                            </div>

                            <div className="mt-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-sm opacity-70">Stan</span>
                                  <span className="text-sm font-medium truncate">
                                    {cur} / {base} {m.unit}
                                  </span>
                                </div>
                                <div className="text-sm font-medium opacity-80 flex-shrink-0">{pct}%</div>
                              </div>

                              <div className="mt-2 h-2 rounded bg-background/60 overflow-hidden">
                                <div
                                  className={`h-full ${pct <= 25 ? "bg-red-500/70" : "bg-foreground/70"}`}
                                  style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="flex items-center justify-between gap-3 pt-2">
              <Link
                href={prevHref}
                className={`border border-border px-3 py-2 rounded bg-card hover:bg-card/80 ${
                  page <= 1 ? "pointer-events-none opacity-50" : ""
                }`}
                aria-disabled={page <= 1}
              >
                ← Poprzednia
              </Link>

              <div className="text-sm opacity-70">Strona {page}</div>

              <Link
                href={nextHref}
                className={`border border-border px-3 py-2 rounded bg-card hover:bg-card/80 ${
                  isLastPage ? "pointer-events-none opacity-50" : ""
                }`}
                aria-disabled={isLastPage}
              >
                Następna →
              </Link>
            </div>
          </form>
        ) : (
          <MaterialsGridClient
            rows={rows as any}
            isLastPage={isLastPage}
            prevHref={prevHref}
            nextHref={nextHref}
            pageLabel={`Strona ${page}`}
          />
        )}
      </div>
    </TransferModeProvider>
  );
}