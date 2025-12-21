"use client";

import { useMemo, useState } from "react";

export type TeamRow = {
  id: string;
  user_id: string | null;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  crew_id: string | null;
  crew_name?: string | null;
  status?: string | null; // optional: active/invited/disabled
  created_at: string;
};

type CrewOption = { id: string; name: string };

type EditPayload = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  // Foreman: tylko crew_id, Manager/Owner: może też dane osobowe (jeśli chcesz)
  crew_id?: string | null;
};

type Props = {
  initial: TeamRow[];

  // Jeśli undefined → UI ukrywa możliwość edycji (read-only)
  onEdit?: (payload: EditPayload) => Promise<void>;

  // jeśli masz listę brygad i chcesz selektor:
  crewOptions?: CrewOption[];

  // jeśli false → nie renderujemy linków/szczegółów
  canOpenDetails: boolean;
};

export default function TeamTable({
  initial,
  onEdit,
  crewOptions,
  canOpenDetails,
}: Props) {
  const [rows, setRows] = useState<TeamRow[]>(initial);
  const [busyId, setBusyId] = useState<string | null>(null);

  const canEdit = typeof onEdit === "function";
  const hasCrews = Array.isArray(crewOptions) && crewOptions.length > 0;

  function setField(id: string, patch: Partial<TeamRow>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function save(m: TeamRow) {
    if (!onEdit) return;
    setBusyId(m.id);
    try {
      await onEdit({
        id: m.id,
        first_name: m.first_name ?? null,
        last_name: m.last_name ?? null,
        phone: m.phone ?? null,
        crew_id: m.crew_id ?? null,
      });
    } catch (e: any) {
      alert(e?.message ?? "Błąd zapisu");
    } finally {
      setBusyId(null);
    }
  }

  const crewNameById = useMemo(() => {
    const map = new Map<string, string>();
    (crewOptions ?? []).forEach((c) => map.set(c.id, c.name));
    return map;
  }, [crewOptions]);

  return (
    <table className="w-full text-sm">
      <thead className="text-left text-foreground/70">
        <tr>
          <th className="py-2 pr-3">ID</th>
          <th className="py-2 pr-3">Imię</th>
          <th className="py-2 pr-3">Nazwisko</th>
          <th className="py-2 pr-3">Telefon</th>
          <th className="py-2 pr-3">Email</th>
          <th className="py-2 pr-3">Brygada</th>
          <th className="py-2 pr-3">Utworzony</th>
          {canEdit && <th className="py-2">Akcje</th>}
        </tr>
      </thead>

      <tbody>
        {rows.map((m) => {
          const created = m.created_at ? new Date(m.created_at).toLocaleDateString() : "—";
          const shortId = m.user_id?.slice(0, 8) || m.id.slice(0, 8);

          const crewLabel =
            m.crew_name ??
            (m.crew_id ? crewNameById.get(m.crew_id) ?? "—" : "—");

          return (
            <tr key={m.id} className="border-t border-border">
              <td className="py-2 pr-3">
                {canOpenDetails ? (
                  <a className="hover:underline" href={`/team/${m.id}`}>
                    {shortId}
                  </a>
                ) : (
                  <span>{shortId}</span>
                )}
              </td>

              <td className="py-2 pr-3">
                <input
                  className="border rounded p-1 bg-transparent w-full"
                  value={m.first_name ?? ""}
                  disabled={!canEdit}
                  onChange={(e) => setField(m.id, { first_name: e.target.value })}
                />
              </td>

              <td className="py-2 pr-3">
                <input
                  className="border rounded p-1 bg-transparent w-full"
                  value={m.last_name ?? ""}
                  disabled={!canEdit}
                  onChange={(e) => setField(m.id, { last_name: e.target.value })}
                />
              </td>

              <td className="py-2 pr-3">
                <input
                  className="border rounded p-1 bg-transparent w-full"
                  value={m.phone ?? ""}
                  disabled={!canEdit}
                  onChange={(e) => setField(m.id, { phone: e.target.value })}
                />
              </td>

              <td className="py-2 pr-3">{m.email ?? "—"}</td>

              <td className="py-2 pr-3">
                {canEdit && hasCrews ? (
                  <select
                    className="border rounded p-1 bg-transparent w-full"
                    value={m.crew_id ?? ""}
                    onChange={(e) =>
                      setField(m.id, { crew_id: e.target.value || null })
                    }
                  >
                    <option value="">— brak —</option>
                    {crewOptions!.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="opacity-80">{crewLabel}</span>
                )}
              </td>

              <td className="py-2 pr-3">{created}</td>

              {canEdit && (
                <td className="py-2">
                  <button
                    className="border rounded px-2 py-1"
                    onClick={() => save(m)}
                    disabled={busyId === m.id}
                  >
                    {busyId === m.id ? "Zapisuję…" : "Zapisz"}
                  </button>
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
