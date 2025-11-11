import { supabaseServer } from '@/lib/supabaseServer';
import InviteForm from './InviteForm';

export default async function TeamPage() {
  const sb = await supabaseServer();

  // tylko manager ma dostęp
  const [{ data: roleRow }, { data: userRes }] = await Promise.all([
    sb.rpc('current_app_role'),
    sb.auth.getUser(),
  ]);
  const user = userRes?.user;
  if (!user || roleRow !== 'manager') {
    return <main className="p-6">Brak dostępu</main>;
  }

  // czytamy z team_members → BEZ user_id
  const { data: members, error } = await sb
    .from('team_members')
    .select('id, first_name, last_name, email, phone, role, created_at')
    .order('created_at', { ascending: true });

  if (error) {
    return <main className="p-6">Błąd: {error.message}</main>;
  }

  return (
    <main className="p-6 space-y-6">
      <div className="flex gap-3 border-b border-border pb-2">
        <button className="font-semibold text-foreground">👥 Użytkownicy</button>
      </div>

      <h1 className="text-2xl font-semibold">Zespół</h1>

      <section className="border rounded p-4 space-y-3">
        <h2 className="text-lg font-medium">Zaproś nowego użytkownika</h2>
        <InviteForm />
      </section>

      <section className="border rounded p-4 space-y-3">
        <h2 className="text-lg font-medium">Obecni użytkownicy</h2>
        <table className="w-full text-sm border-collapse">
          <thead className="border-b text-zinc-400">
            <tr>
              <th className="text-left py-2 px-3">ID</th>
              <th className="text-left py-2 px-3">Imię i nazwisko</th>
              <th className="text-left py-2 px-3">Email</th>
              <th className="text-left py-2 px-3">Telefon</th>
              <th className="text-left py-2 px-3">Rola</th>
              <th className="text-left py-2 px-3">Utworzony</th>
            </tr>
          </thead>
          <tbody>
            {members?.length ? (
              members.map((m) => (
                <tr key={m.id} className="border-b">
                  <td className="py-2 px-3">{String(m.id).slice(0, 8)}…</td>
                  <td className="py-2 px-3">
                    {(m.first_name || '').trim()} {(m.last_name || '').trim()}
                  </td>
                  <td className="py-2 px-3">{m.email ?? '—'}</td>
                  <td className="py-2 px-3">{m.phone ?? '—'}</td>
                  <td className="py-2 px-3">{m.role}</td>
                  <td className="py-2 px-3 text-zinc-400">
                    {m.created_at ? new Date(m.created_at).toLocaleDateString('pl-PL') : '—'}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="py-3 text-zinc-500 text-center">Brak użytkowników.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
