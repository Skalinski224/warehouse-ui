// src/app/(app)/object/page.tsx
import { redirect } from "next/navigation";

import { supabaseServer } from "@/lib/supabaseServer";
import type { PermissionSnapshot } from "@/lib/permissions";

import BackButton from "@/components/BackButton";
import PlaceForm from "@/components/object/PlaceForm";

import PlacesListClient from "./_components/PlacesListClient";

export const dynamic = "force-dynamic";

export type PlaceRow = {
  id: string;
  name: string;
  description: string | null;
};

async function fetchRootPlaces(): Promise<PlaceRow[]> {
  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from("project_places")
    .select("id, name, description")
    .is("parent_id", null)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error) {
    console.error("fetchRootPlaces error:", error);
    return [];
  }

  return (data as PlaceRow[]) ?? [];
}

function unwrapSnapshot(data: unknown): PermissionSnapshot | null {
  if (!data) return null;
  if (Array.isArray(data)) return (data[0] as PermissionSnapshot) ?? null;
  return data as PermissionSnapshot;
}

function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "ok" | "warn";
}) {
  const cls =
    tone === "ok"
      ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-300"
      : tone === "warn"
      ? "border-amber-500/35 bg-amber-500/10 text-amber-300"
      : "border-border bg-background/60 text-foreground/80";

  return (
    <span className={`inline-flex items-center rounded px-2 py-1 text-[11px] border ${cls}`}>
      {children}
    </span>
  );
}

export default async function ObjectRootPage() {
  const supabase = await supabaseServer();

  const { data, error } = await supabase.rpc("my_permissions_snapshot");
  const snapshot = unwrapSnapshot(data);

  if (!snapshot || error) redirect("/");

  // TEMP gating po roli (dopóki nie podepniesz PERM.OBJECT_*):
  if (snapshot.role === "worker" || snapshot.role === "storeman") redirect("/");

  const places = await fetchRootPlaces();
  const total = places.length;

  return (
    <main className="p-6 space-y-4">
      {/* HEADER (KANON) */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-sm font-medium">Obiekt</h1>
          <p className="text-xs opacity-70">
            Główne miejsca na projekcie i ich struktura. Kliknij w miejsce, aby wejść do środka.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Pill tone="neutral">
            Miejsc: <span className="font-semibold ml-1">{total}</span>
          </Pill>
          <BackButton className="inline-flex items-center justify-center rounded-xl border border-border bg-background px-3 py-2 text-xs hover:bg-foreground/5 transition" />
        </div>
      </header>

      {/* TOOLBAR: dodawanie + kontekst */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="text-sm font-medium">Dodaj główne miejsce</div>
            <div className="text-xs opacity-70">
              To jest poziom “root” (bez parent_id). Potem wchodzisz w miejsce i budujesz strukturę.
            </div>
          </div>

          <div className="shrink-0">
            {/* PlaceForm jest już Twoim komponentem — zostawiamy go bez grzebania */}
            <PlaceForm parentId={null} />
          </div>
        </div>
      </section>

      {/* LISTA */}
      <section className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="border-b border-border/70 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold">Główne miejsca</h2>
              <p className="text-xs opacity-70">
                Szukaj i wchodź w miejsca — dalej budujesz podmiejsca w widoku miejsca.
              </p>
            </div>

            <div className="shrink-0">
              <Pill tone={total === 0 ? "warn" : "ok"}>
                {total === 0 ? "Brak danych" : "OK"}
              </Pill>
            </div>
          </div>
        </div>

        <div className="p-4">
          {!places || places.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 bg-background/20 p-6 text-sm opacity-70">
              Brak zdefiniowanych miejsc. Dodaj pierwsze miejsce, aby zacząć budować strukturę obiektu.
            </div>
          ) : (
            <PlacesListClient places={places} />
          )}
        </div>
      </section>
    </main>
  );
}
