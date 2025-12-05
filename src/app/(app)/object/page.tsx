import Link from "next/link";
import { supabaseServer } from "@/lib/supabaseServer";
import RoleGuard from "@/components/RoleGuard";
import PlaceForm from "@/components/object/PlaceForm";
import PlaceDeleteButton from "@/components/object/PlaceDeleteButton";

type PlaceRow = {
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

export default async function ObjectRootPage() {
  const places = await fetchRootPlaces();

  return (
    <RoleGuard
      allow={["owner", "manager"]}
      fallback={
        <div className="text-sm text-foreground/70">
          Nie masz uprawnień do podglądu struktury obiektu.
        </div>
      }
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Obiekt</h1>
            <p className="text-sm text-foreground/70">
              Główne miejsca na projekcie i ich struktura.
            </p>
          </div>

          {/* Dodawanie nowego miejsca root (bez parent_id) */}
          <PlaceForm parentId={null} />
        </div>

        {/* Lista miejsc root */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground/80">
            Główne miejsca
          </h2>

          {(!places || places.length === 0) && (
            <div className="text-sm text-foreground/60 border border-dashed border-border/60 rounded-lg px-4 py-6">
              Brak zdefiniowanych miejsc. Dodaj pierwsze miejsce, aby zacząć
              budować strukturę obiektu.
            </div>
          )}

          {places && places.length > 0 && (
            <ul className="space-y-1">
              {places.map((place) => (
                <li key={place.id}>
                  <div className="group flex items-start justify-between gap-2 rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-sm hover:border-border hover:bg-card transition">
                    <div>
                      <div className="font-medium group-hover:underline">
                        {place.name}
                      </div>
                      {place.description && (
                        <div className="text-xs text-foreground/70 mt-0.5">
                          {place.description}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <Link
                        href={`/object/${place.id}`}
                        className="text-[11px] text-foreground/70 hover:text-foreground hover:underline"
                      >
                        Otwórz &rarr;
                      </Link>

                      {/* Soft delete całego miejsca z poziomu listy głównej */}
                      <PlaceDeleteButton placeId={place.id} parentId={null} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </RoleGuard>
  );
}
