// src/components/DailyReportsTable.tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import ApproveButton from "@/components/ApproveButton";
import { approveDailyReport } from "@/lib/actions";

type Item = { material_name?: string | null; quantity_used?: number | null };
type Report = {
  id: string | number;
  crew: string | null;
  place_id: string | null;
  status: "pending" | "approved";
  date: string;
  task_name?: string | null;
  photos_count?: number | null;
  daily_report_items?: Item[];
  items?: Item[]; // fallback
};

export default function DailyReportsTable({ reports }: { reports: Report[] }) {
  const [open, setOpen] = useState<Record<string | number, boolean>>({});

  const rows = useMemo(
    () =>
      (reports ?? []).map((r) => {
        const mats = (r.daily_report_items ?? r.items ?? []) as Item[];
        const matsCount = mats.length;
        const photos = r.photos_count ?? 0;
        return { ...r, mats, matsCount, photos };
      }),
    [reports]
  );

  if (!rows.length) {
    return (
      <div className="border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-zinc-900">
            <tr>
              <th className="text-left p-2">ID</th>
              <th className="text-left p-2">Brygada</th>
              <th className="text-left p-2">Miejsce</th>
              <th className="text-left p-2">Zadanie</th>
              <th className="text-left p-2">Materiałów</th>
              <th className="text-left p-2">Zdjęcia</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Data</th>
              <th className="p-2">Akcje</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="p-3 text-center text-gray-500" colSpan={9}>
                Brak wyników (zmień filtry).
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="border rounded overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-zinc-900">
          <tr>
            <th className="text-left p-2">ID</th>
            <th className="text-left p-2">Brygada</th>
            <th className="text-left p-2">Miejsce</th>
            <th className="text-left p-2">Zadanie</th>
            <th className="text-left p-2">Materiałów</th>
            <th className="text-left p-2">Zdjęcia</th>
            <th className="text-left p-2">Status</th>
            <th className="text-left p-2">Data</th>
            <th className="p-2">Akcje</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200/50 dark:divide-zinc-800">
          {rows.map((r) => {
            const isOpen = !!open[r.id];
            return (
              <>
                <tr key={r.id}>
                  <td className="p-2">
                    <button
                      type="button"
                      onClick={() =>
                        setOpen((prev) => ({ ...prev, [r.id]: !prev[r.id] }))
                      }
                      className="mr-2 px-1 rounded border text-xs"
                      title={isOpen ? "Schowaj materiały" : "Pokaż materiały"}
                    >
                      {isOpen ? "−" : "+"}
                    </button>
                    <Link
                      href={`/reports/daily/${r.id}`}
                      className="underline"
                      title="Szczegóły raportu"
                    >
                      {r.id}
                    </Link>
                  </td>
                  <td className="p-2">{r.crew ?? "—"}</td>
                  <td className="p-2">{r.place_id ?? "—"}</td>
                  <td className="p-2">{r.task_name ?? "—"}</td>
                  <td className="p-2">{r.matsCount}</td>
                  <td className="p-2">
                    {r.photos} / 3
                  </td>
                  <td className="p-2">
                    {r.status === "approved" ? (
                      <span className="rounded bg-green-700/20 px-2 py-0.5">
                        zatwierdzony
                      </span>
                    ) : (
                      <span className="rounded bg-yellow-700/20 px-2 py-0.5">
                        w toku
                      </span>
                    )}
                  </td>
                  <td className="p-2">{r.date}</td>
                  <td className="p-2">
                    {r.status === "pending" ? (
                      <form action={approveDailyReport}>
                        <input
                          type="hidden"
                          name="report_id"
                          value={String(r.id)}
                        />
                        <ApproveButton>Akceptuj</ApproveButton>
                      </form>
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </td>
                </tr>

                {/* Wiersz rozwijany z listą materiałów */}
                {isOpen && (
                  <tr key={`${r.id}-details`} className="bg-black/5 dark:bg-white/5">
                    <td colSpan={9} className="p-2">
                      {r.mats.length === 0 ? (
                        <div className="text-sm text-gray-500">
                          Brak pozycji materiałowych.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr>
                                <th className="text-left p-2">Materiał</th>
                                <th className="text-left p-2">Ilość</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-200/50 dark:divide-zinc-800">
                              {r.mats.map((m, idx) => (
                                <tr key={idx}>
                                  <td className="p-2">{m.material_name ?? "—"}</td>
                                  <td className="p-2">
                                    {m.quantity_used ?? 0}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
