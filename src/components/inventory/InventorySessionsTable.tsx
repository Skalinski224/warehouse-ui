// src/components/inventory/InventorySessionsTable.tsx
import Link from "next/link";

type Row = {
  id: string;
  session_date: string;
  person: string | null;
  description: string | null;
  approved: boolean;
};

export default function InventorySessionsTable({
  rows,
}: {
  rows: Row[];
}) {
  if (!rows.length) {
    return (
      <div className="card p-4 text-xs text-muted-foreground">
        Brak inwentaryzacji dla wybranych filtrów.
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <table className="w-full text-xs">
        <thead className="border-b border-border text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">Data</th>
            <th className="px-3 py-2 text-left">Osoba</th>
            <th className="px-3 py-2 text-left">Opis</th>
            <th className="px-3 py-2 text-left">Status</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              className="border-b border-border last:border-0 hover:bg-background/50"
            >
              <td className="px-3 py-2">
                <Link
                  href={`/inventory/${r.id}`}
                  className="hover:underline"
                >
                  {r.session_date}
                </Link>
              </td>

              <td className="px-3 py-2">
                {r.person || "—"}
              </td>

              <td className="px-3 py-2 text-muted-foreground">
                {r.description || "—"}
              </td>

              <td className="px-3 py-2">
                {r.approved ? (
                  <span className="rounded-md border border-border px-2 py-1">
                    Zatwierdzona
                  </span>
                ) : (
                  <span className="rounded-md border border-border px-2 py-1 text-muted-foreground">
                    Draft
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
