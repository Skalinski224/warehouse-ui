"use client";
import { useState } from "react";

export type ReportFiltersValue = {
  from?: string;
  to?: string;
  crew?: string;
  place?: string;
  status?: string;
  q?: string;
};

export default function ReportFilters({
  onApply,
  presets = {
    crews: ["A", "B", "C"],
    places: ["Plac A", "Plac B", "Plac C"],
    statuses: ["approved", "pending"],
  },
}: {
  onApply: (v: ReportFiltersValue) => void;
  presets?: { crews: string[]; places: string[]; statuses: string[] };
}) {
  const [v, setV] = useState<ReportFiltersValue>({});

  const set = (k: keyof ReportFiltersValue, val: string) =>
    setV((p) => ({ ...p, [k]: val || undefined }));

  return (
    <div className="border rounded p-3 mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
      <input
        type="date"
        className="border rounded p-2"
        value={v.from ?? ""}
        onChange={(e) => set("from", e.target.value)}
      />
      <input
        type="date"
        className="border rounded p-2"
        value={v.to ?? ""}
        onChange={(e) => set("to", e.target.value)}
      />
      <select
        className="border rounded p-2"
        value={v.crew ?? ""}
        onChange={(e) => set("crew", e.target.value)}
      >
        <option value="">Brygada</option>
        {presets.crews.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <select
        className="border rounded p-2"
        value={v.place ?? ""}
        onChange={(e) => set("place", e.target.value)}
      >
        <option value="">Miejsce</option>
        {presets.places.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>

      <select
        className="border rounded p-2"
        value={v.status ?? ""}
        onChange={(e) => set("status", e.target.value)}
      >
        <option value="">Status</option>
        {presets.statuses.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <input
        placeholder="Szukaj…"
        className="border rounded p-2 lg:col-span-2"
        value={v.q ?? ""}
        onChange={(e) => set("q", e.target.value)}
      />

      <div className="lg:col-span-4 flex gap-2">
        <button type="button" className="px-3 py-2 border rounded" onClick={() => onApply(v)}>
          Zastosuj
        </button>
        <button
          type="button"
          className="px-3 py-2 border rounded"
          onClick={() => {
            setV({});
            onApply({});
          }}
        >
          Wyczyść
        </button>
      </div>
    </div>
  );
}
