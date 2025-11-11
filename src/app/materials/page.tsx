import { supabaseServer } from "@/lib/supabaseServer";
import CatalogToolbar from "./_components/CatalogToolbar";
import { MaterialCard } from "./_components/MaterialCard";
import AddMaterialDialog from "./_components/AddMaterialDialog";

type SortKey = "AZ" | "ZA" | "MOST" | "LEAST";

export default async function MaterialsPage({
  searchParams,
}: {
  searchParams: { sort?: SortKey };
}) {
  const sort: SortKey = (searchParams.sort as SortKey) ?? "AZ";

  // 👇 KLUCZ: poczekaj na klienta
  const supabase = await supabaseServer();

  // kolumna + kierunek w zależności od sortowania
  const orderCol: "name" | "current_quantity" =
    sort === "MOST" || sort === "LEAST" ? "current_quantity" : "name";
  const ascending =
    sort === "AZ" || sort === "LEAST" ? true : false;

  const { data, error } = await supabase
    .from("v_materials_overview")
    .select(
      "id,name,unit,image_url,base_quantity,current_quantity,deleted_at"
    )
    .is("deleted_at", null)
    .order(orderCol, { ascending });

  if (error) {
    return (
      <section className="p-6">
        <div className="card border border-red-500/30">
          <div className="text-red-300 font-medium">
            Nie udało się pobrać materiałów.
          </div>
          <div className="text-foreground/60 text-sm mt-1 break-all">
            {error.message}
          </div>
        </div>

        <div className="mt-6">
          <CatalogToolbar sort={sort} />
          <AddMaterialDialog />
        </div>
      </section>
    );
  }

  const items = data ?? [];

  return (
    <section className="p-6">
      <div className="flex items-center gap-3">
        <CatalogToolbar sort={sort} />
      </div>

      <AddMaterialDialog />

      <div className="mt-6 grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((m: any) => (
          <MaterialCard key={m.id} {...m} />
        ))}
        {items.length === 0 && (
          <div className="text-sm text-foreground/60">Brak materiałów.</div>
        )}
      </div>
    </section>
  );
}
