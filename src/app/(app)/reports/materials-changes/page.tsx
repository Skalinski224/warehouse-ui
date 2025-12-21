// src/app/(app)/reports/materials-changes/page.tsx
import { redirect } from "next/navigation";
import BackButton from "@/components/BackButton";
import { fetchMaterialsChangesList } from "@/lib/queries/materialsChanges";
import MaterialsChangesClient from "./_components/MaterialsChangesClient";

type SearchParams = Record<string, string | string[] | undefined>;

function getParam(sp: SearchParams, key: string): string {
  const v = sp?.[key];
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export default async function MaterialsChangesReportPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const spObj = await searchParams;

  const q = getParam(spObj, "q").trim();
  const from = getParam(spObj, "from").trim();
  const to = getParam(spObj, "to").trim();

  const page = Math.max(1, Number(getParam(spObj, "page") || 1));
  const limit = 100;
  const offset = (page - 1) * limit;

  const { rows, canRead } = await fetchMaterialsChangesList({
    q: q || null,
    from: from || null,
    to: to || null,
    limit,
    offset,
    dir: "desc",
  });

  if (!canRead) redirect("/");

  return (
    <main className="p-6 space-y-4">
      {/* HEADER (KANON) */}
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-sm font-medium truncate">Zmiany w materiałach</h1>
          <p className="text-xs opacity-70">
            Widzisz <span className="font-medium">kto</span> i{" "}
            <span className="font-medium">kiedy</span> zrobił zmianę. Szczegóły
            (wartości przed/po) są po wejściu w pozycję.
          </p>
        </div>

        <BackButton className="px-3 py-2 rounded border border-border bg-card hover:bg-card/80 text-xs transition" />
      </header>

      <MaterialsChangesClient
        initialRows={rows}
        initialParams={{ q, from, to, page }}
        limit={limit}
      />
    </main>
  );
}
