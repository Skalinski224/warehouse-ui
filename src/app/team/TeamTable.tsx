'use client';

import { useState } from 'react';

type Member = {
  id: string;
  user_id: string | null;
  email: string | null;
  first_name: string;
  last_name: string;
  phone: string | null;
  role: 'manager' | 'storeman' | 'worker';
  created_at: string;
};

export default function TeamTable({ initial }: { initial: Member[] }) {
  const [rows, setRows] = useState<Member[]>(initial);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function save(m: Member) {
    setBusyId(m.id);
    try {
      const res = await fetch(`/api/team/member/${m.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          first_name: m.first_name,
          last_name: m.last_name,
          phone: m.phone,
          role: m.role,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Błąd zapisu');
      alert('✅ Zapisano');
    } catch (e: any) {
      alert(e.message || 'Błąd');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <table className="w-full text-sm">
      <thead className="text-left opacity-70">
        <tr>
          <th className="py-2 pr-3">ID</th>
          <th className="py-2 pr-3">Imię</th>
          <th className="py-2 pr-3">Nazwisko</th>
          <th className="py-2 pr-3">Telefon</th>
          <th className="py-2 pr-3">Email</th>
          <th className="py-2 pr-3">Rola</th>
          <th className="py-2 pr-3">Utworzony</th>
          <th className="py-2">Akcje</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((m) => (
          <tr key={m.id} className="border-t border-border">
            <td className="py-2 pr-3">{m.user_id?.slice(0, 8) || '—'}</td>
            <td className="py-2 pr-3">
              <input
                className="border rounded p-1 bg-transparent"
                value={m.first_name}
                onChange={(e) =>
                  setRows((rs) => rs.map(r => r.id === m.id ? { ...r, first_name: e.target.value } : r))
                }
              />
            </td>
            <td className="py-2 pr-3">
              <input
                className="border rounded p-1 bg-transparent"
                value={m.last_name}
                onChange={(e) =>
                  setRows((rs) => rs.map(r => r.id === m.id ? { ...r, last_name: e.target.value } : r))
                }
              />
            </td>
            <td className="py-2 pr-3">
              <input
                className="border rounded p-1 bg-transparent"
                value={m.phone ?? ''}
                onChange={(e) =>
                  setRows((rs) => rs.map(r => r.id === m.id ? { ...r, phone: e.target.value } : r))
                }
              />
            </td>
            <td className="py-2 pr-3">{m.email ?? '—'}</td>
            <td className="py-2 pr-3">
              <select
                className="border rounded p-1 bg-transparent"
                value={m.role}
                onChange={(e) =>
                  setRows((rs) => rs.map(r => r.id === m.id ? { ...r, role: e.target.value as Member['role'] } : r))
                }
              >
                <option value="worker">worker</option>
                <option value="storeman">storeman</option>
                <option value="manager">manager</option>
              </select>
            </td>
            <td className="py-2 pr-3">{new Date(m.created_at).toLocaleDateString()}</td>
            <td className="py-2">
              <button
                className="border rounded px-2 py-1"
                onClick={() => save(m)}
                disabled={busyId === m.id}
              >
                {busyId === m.id ? 'Zapisuję…' : 'Zapisz'}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
