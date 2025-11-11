import Link from 'next/link';
import { supabaseServer } from '@/lib/supabaseServer';

export default async function CrewsPage() {
  const supa = await supabaseServer();
  const { data: { user } } = await supa.auth.getUser();
  const { data: role } = await supa.rpc('current_app_role');

  if (!user || role !== 'manager') {
    return <main className="p-6">Brak dostępu</main>;
  }

  // pobierz brygady dla danego konta
  const { data: crews } = await supa
    .from('crews')
    .select('id, name')
    .order('name', { ascending: true });

  return (
    <main className="p-6 space-y-6">
      {/* 🔘 Nawigacja górna */}
      <div className="flex gap-3 border-b border-border pb-2">
        <Link href="/team" className="text-zinc-400 hover:text-foreground transition">
          👥 Użytkownicy
        </Link>
        <button className="font-semibold text-foreground">🧱 Brygady</button>
      </div>

      <h1 className="text-2xl font-semibold">Brygady</h1>

      <form action="/api/team/crews/add" method="post" className="flex gap-2 border p-4 rounded">
        <input
          name="crew_name"
          placeholder="Nazwa brygady"
          className="border rounded p-2 bg-transparent flex-1"
          required
        />
        <button className="border rounded px-3 py-2">Dodaj</button>
      </form>

      <div className="grid gap-3 md:grid-cols-2">
        {crews && crews.length > 0 ? (
          crews.map((c) => (
            <div key={c.id} className="border rounded p-3 space-y-2">
              <div className="font-medium">{c.name}</div>
              <div className="text-sm text-zinc-500">Tu w przyszłości: członkowie brygady</div>
            </div>
          ))
        ) : (
          <div className="text-sm text-zinc-500">Brak brygad.</div>
        )}
      </div>
    </main>
  );
}
