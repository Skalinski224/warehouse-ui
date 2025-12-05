// src/app/(app)/materials/[id]/page.tsx
import Link from "next/link";
import { supabaseServer } from "@/lib/supabaseServer";
import { updateMaterial, softDeleteMaterial, restoreMaterial } from "@/lib/actions";

type Material = {
  id: string;
  title: string;
  description: string | null;
  unit: string;
  base_quantity: number;
  current_quantity: number;
  image_url: string | null;
  cta_url: string | null;
  created_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
};

function fmtDate(s?: string | null) {
  if (!s) return "";
  const d = new Date(s);
  return d.toLocaleString();
}

/** Akcja: update wybranych pól (tytuł, opis, jednostka, ilości, CTA) */
async function saveMaterial(formData: FormData) {
  "use server";

  const id = String(formData.get("id") || "");
  if (!id) throw new Error("Brak id materiału");

  const patch: Record<string, unknown> = {};

  for (const key of [
    "title",
    "description",
    "unit",
    "base_quantity",
    "current_quantity",
    "cta_url",
  ] as const) {
    if (!formData.has(key)) continue;
    const v = formData.get(key);

    if (v !== null && v !== "") {
      if (key === "base_quantity" || key === "current_quantity") {
        patch[key] = Number(v);
      } else {
        patch[key] = String(v);
      }
    } else {
      if (key === "description" || key === "cta_url") {
        patch[key] = null;
      }
    }
  }

  await updateMaterial(id, patch);
}

/** Akcja: soft delete */
async function doDelete(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  if (!id) return;
  await softDeleteMaterial(id);
}

/** Akcja: restore */
async function doRestore(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  if (!id) return;
  await restoreMaterial(id);
}

// Next 16: params są Promise<{ id: string }>
type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function MaterialDetailsPage(props: PageProps) {
  const { id } = await props.params;
  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from("materials")
    .select(
      "id,title,description,unit,base_quantity,current_quantity,image_url,cta_url,created_at,deleted_at,deleted_by"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return (
      <div className="p-6 space-y-4">
        <div className="text-sm">
          <Link href="/materials" className="text-foreground/80 hover:underline">
            ← Katalog materiałów
          </Link>
        </div>
        <h1 className="text-2xl font-semibold">Szczegóły materiału</h1>
        <pre className="text-red-400 text-sm whitespace-pre-wrap">
          DB error: {error.message}
        </pre>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 space-y-4">
        <div className="text-sm">
          <Link href="/materials" className="text-foreground/80 hover:underline">
            ← Katalog materiałów
          </Link>
        </div>
        <h1 className="text-2xl font-semibold">Szczegóły materiału</h1>
        <p className="text-sm text-foreground/80">
          Ten materiał nie istnieje albo nie masz do niego dostępu (RLS / account_id).
        </p>
      </div>
    );
  }

  const m = data as Material;
  const pct =
    m.base_quantity && Number(m.base_quantity) > 0
      ? Math.round((Number(m.current_quantity) / Number(m.base_quantity)) * 100)
      : 0;

  return (
    <div className="p-6 space-y-6">
      {/* Breadcrumbs + status */}
      <div className="flex items-center justify-between">
        <div className="text-sm">
          <Link href="/materials" className="text-foreground/80 hover:underline">
            ← Katalog materiałów
          </Link>
        </div>
        {m.deleted_at ? (
          <span className="text-xs px-2 py-1 rounded bg-red-500/20 border border-red-500/30 text-red-200">
            usunięty {fmtDate(m.deleted_at)}
          </span>
        ) : null}
      </div>

      <div className="grid gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)]">
        {/* LEWA KARTA: miniatura + (na przyszłość) upload */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
          <div className="text-sm font-medium mb-1">Miniaturka</div>
          <div className="aspect-square w-full bg-background/50 relative overflow-hidden rounded-xl border border-border flex items-center justify-center text-xs opacity-60">
            {m.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={m.image_url}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <span>brak miniatury</span>
            )}
          </div>

          <div className="grid gap-2 pt-2">
            <label className="text-sm">Zmień miniaturę (w przygotowaniu)</label>
            <input
              type="file"
              name="image"
              accept="image/*"
              disabled
              className="border border-border bg-background rounded px-3 py-2 text-xs opacity-60 cursor-not-allowed"
            />
            <p className="text-[11px] opacity-60">
              Upload miniatury podłączymy, gdy dopniemy backend do storage. Na razie
              miniatury pochodzą z dodawania materiału.
            </p>
          </div>
        </div>

        {/* PRAWA KOLUMNA: dane + stan + CTA + akcje */}
        <div className="space-y-6">
          {/* Karta: dane materiału */}
          <form
            action={saveMaterial}
            className="rounded-2xl border border-border bg-card p-4 space-y-4"
          >
            <input type="hidden" name="id" value={m.id} />

            <div className="grid gap-2">
              <label className="text-sm">Tytuł *</label>
              <input
                name="title"
                required
                defaultValue={m.title}
                className="border border-border bg-background rounded px-3 py-2"
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm">Opis</label>
              <textarea
                name="description"
                rows={3}
                defaultValue={m.description ?? ""}
                className="border border-border bg-background rounded px-3 py-2"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2">
                <label className="text-sm">Jednostka</label>
                <select
                  name="unit"
                  defaultValue={m.unit || "szt"}
                  className="border border-border bg-background rounded px-3 py-2"
                >
                  <option value="szt">szt</option>
                  <option value="kg">kg</option>
                  <option value="m">m</option>
                  <option value="m2">m²</option>
                  <option value="m3">m³</option>
                  <option value="l">l</option>
                  <option value="opak">opak</option>
                </select>
              </div>
              <div className="grid gap-2">
                <label className="text-sm">Baza *</label>
                <input
                  type="number"
                  step="0.01"
                  name="base_quantity"
                  required
                  defaultValue={Number(m.base_quantity)}
                  className="border border-border bg-background rounded px-3 py-2"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm">Stan</label>
                <input
                  type="number"
                  step="0.01"
                  name="current_quantity"
                  defaultValue={Number(m.current_quantity)}
                  className="border border-border bg-background rounded px-3 py-2"
                />
              </div>
            </div>

            <div className="flex items-center justify-end">
              <button className="px-4 py-2 rounded border border-border bg-foreground/10 hover:bg-foreground/20 text-sm">
                Zapisz zmiany
              </button>
            </div>
          </form>

          {/* Karta: stan, CTA, historia, usuwanie */}
          <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
            {/* Stan + progress */}
            <div className="space-y-2">
              <div className="text-sm opacity-80">
                Stan: {Number(m.current_quantity)} / {Number(m.base_quantity)} {m.unit} (
                {pct}%)
              </div>
              <div className="h-2 rounded bg-background/60 overflow-hidden">
                <div
                  className={`h-full ${
                    pct <= 25 ? "bg-red-500/70" : "bg-foreground/70"
                  }`}
                  style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
                />
              </div>
            </div>

            {/* CTA */}
            <div className="space-y-2">
              {m.cta_url ? (
                <a
                  href={m.cta_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded border border-border bg-foreground text-background text-sm hover:bg-foreground/90"
                >
                  Zamów produkt →
                </a>
              ) : (
                <button
                  type="button"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded border border-border bg-background/40 text-sm opacity-70 cursor-default"
                >
                  Brak linku do zamówienia
                </button>
              )}

              <details className="text-xs text-foreground/70">
                <summary className="cursor-pointer inline-flex items-center gap-1 underline-offset-2 hover:underline">
                  Dodaj / zmień link
                </summary>
                <form
                  action={saveMaterial}
                  className="mt-2 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center"
                >
                  <input type="hidden" name="id" value={m.id} />
                  <input
                    name="cta_url"
                    type="url"
                    defaultValue={m.cta_url ?? ""}
                    placeholder="https://sklep.example.com/produkt"
                    className="flex-1 border border-border bg-background rounded px-3 py-2 text-xs"
                  />
                  <button className="px-3 py-2 rounded border border-border bg-card hover:bg-card/80 text-xs whitespace-nowrap">
                    Zapisz URL
                  </button>
                </form>
              </details>
            </div>

            {/* Historia + akcje usunięcia */}
            <div className="pt-3 border-t border-border flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs opacity-75">
              <div>
                <div>Dodano: {fmtDate(m.created_at)}</div>
                {m.deleted_at && <div>Usunięto: {fmtDate(m.deleted_at)}</div>}
              </div>

              <div className="flex items-center gap-2 md:justify-end">
                {m.deleted_at ? (
                  <form action={doRestore}>
                    <input type="hidden" name="id" value={m.id} />
                    <button className="px-3 py-2 rounded border border-green-600/40 bg-green-600/20 hover:bg-green-600/30 text-green-100 text-xs">
                      Przywróć pozycję
                    </button>
                  </form>
                ) : (
                  <form action={doDelete}>
                    <input type="hidden" name="id" value={m.id} />
                    <button className="px-3 py-2 rounded border border-red-600/40 bg-red-600/20 hover:bg-red-600/30 text-red-100 text-xs">
                      Usuń z katalogu
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
