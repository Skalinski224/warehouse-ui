// app/object/page.tsx
import { supabase } from '@/lib/supabaseClient';
import {
  addPlace, updatePlace, deletePlace,
  addDesignerPlan, deleteDesignerPlan
} from '@/lib/actions';

type Place = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  deleted_at: string | null;
};

type Stage = { id: string; name: string };

type PlanRow = {
  id: string;
  family_key: string;
  planned_qty: number | null;
  planned_cost: number | null;          // już policzony (widok)
  stage_id: string | null;
  place_id: string | null;
  stage_name?: string | null;
  place_name?: string | null;
};

export default async function Page() {
  // Miejsca (aktywe)
  const { data: places } = await supabase
    .from('project_places')
    .select('id, name, description, created_at, deleted_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  // Etapy (dla dropdownu)
  const { data: stages } = await supabase
    .from('project_stages')
    .select('id, name')
    .order('name');

  // Plany z widoku normalizującego koszt
  const { data: plansRaw, error: plansErr } = await supabase
    .from('v_designer_plans_norm') // <— widok z SQL (coalesce(cost, qty*unit_price))
    .select('id, family_key, planned_qty, planned_cost, stage_id, place_id');

  if (plansErr) {
    console.warn('v_designer_plans_norm error:', plansErr.message ?? plansErr);
  }

  const plans: PlanRow[] = (plansRaw ?? []).map((p: any) => ({
    ...p,
    stage_name: (stages ?? []).find(s => s.id === p.stage_id)?.name ?? null,
    place_name: (places ?? []).find(pl => pl.id === p.place_id)?.name ?? null,
  }));

  const fmtNum = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2 });
  const fmtCur = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', minimumFractionDigits: 2 });

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Obiekt – miejsca i założenia</h1>

      {/* Sekcja: Miejsca */}
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Miejsca na projekcie</h2>

        {/* Dodaj miejsce */}
        <form action={addPlace} className="grid gap-2 md:grid-cols-6 border rounded p-3">
          <input
            name="name"
            placeholder="Nazwa miejsca (np. Boiler Room, Ściana zachodnia)"
            className="border rounded p-2 bg-transparent md:col-span-3"
            required
          />
          <input
            name="description"
            placeholder="Opis (opcjonalnie)"
            className="border rounded p-2 bg-transparent md:col-span-3"
          />
          <button className="border rounded px-3 py-2 md:col-span-1">Dodaj</button>
        </form>

        {/* Lista miejsc */}
        <div className="grid gap-2">
          {(places ?? []).map(pl => (
            <div key={pl.id} className="border rounded px-3 py-2 flex items-center justify-between">
              <div className="text-sm">
                <div className="font-medium">{pl.name}</div>
                <div className="text-xs text-zinc-500">{pl.description ?? '—'}</div>
                <div className="text-xs text-zinc-500">utw.: {new Date(pl.created_at).toLocaleString()}</div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  className="px-2 py-1 border rounded text-xs"
                  href={`/reports/daily?place=${encodeURIComponent(pl.name)}`}
                >
                  Raporty z miejsca
                </a>

                <details className="inline-block">
                  <summary className="cursor-pointer px-2 py-1 border rounded text-xs">Edytuj</summary>
                  <form action={updatePlace} className="mt-2 grid gap-2 p-2 border rounded">
                    <input type="hidden" name="id" value={pl.id} />
                    <input name="name" defaultValue={pl.name} className="border rounded p-1 bg-transparent" />
                    <input name="description" defaultValue={pl.description ?? ''} className="border rounded p-1 bg-transparent" />
                    <button className="px-2 py-1 border rounded text-xs">Zapisz</button>
                  </form>
                </details>

                <form action={deleteDesignerPlan} className="hidden" />
                <form action={deletePlace}>
                  <input type="hidden" name="id" value={pl.id} />
                  <button className="px-2 py-1 border rounded text-xs">Usuń</button>
                </form>
              </div>
            </div>
          ))}

          {(places ?? []).length === 0 && (
            <div className="text-sm text-zinc-500">Brak miejsc – dodaj pierwsze powyżej.</div>
          )}
        </div>
      </section>

      {/* Sekcja: Założenia projektanta */}
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Założenia projektanta (Plan)</h2>

        {/* Dodaj plan: rodzina + ilość + koszt albo cena jedn. + (opcjonalnie etap/miejsce) */}
        <form action={addDesignerPlan} className="grid gap-2 md:grid-cols-10 border rounded p-3">
          <input
            name="family_key"
            placeholder="Rodzina materiałów (np. katownik_90)"
            className="border rounded p-2 bg-transparent md:col-span-2"
            required
          />

          <input
            name="planned_qty"
            type="number"
            step="0.01"
            min="0"
            placeholder="Plan ilość"
            className="border rounded p-2 bg-transparent md:col-span-2"
            required
          />

          {/* Możesz wypełnić KTÓREŚ z tych dwóch: koszt łączny LUB cenę jednostkową */}
          <input
            name="planned_cost"
            type="number"
            step="0.01"
            min="0"
            placeholder="Plan koszt (PLN)"
            className="border rounded p-2 bg-transparent md:col-span-2"
          />
          <input
            name="planned_unit_price"
            type="number"
            step="0.0001"
            min="0"
            placeholder="Cena jedn. (opcjonalnie)"
            className="border rounded p-2 bg-transparent md:col-span-2"
          />

          <select name="stage_id" className="border rounded p-2 bg-transparent md:col-span-1" defaultValue="">
            <option value="">Etap (opcjonalnie)</option>
            {(stages ?? []).map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          <select name="place_id" className="border rounded p-2 bg-transparent md:col-span-1" defaultValue="">
            <option value="">Miejsce (opcjonalnie)</option>
            {(places ?? []).map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <button className="border rounded px-3 py-2 md:col-span-1">Dodaj</button>
        </form>

        {/* Lista planów */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-zinc-400 border-b">
              <tr>
                <th className="py-2 pr-3">Rodzina</th>
                <th className="py-2 pr-3">Etap</th>
                <th className="py-2 pr-3">Miejsce</th>
                <th className="py-2 pr-3">Plan ilość</th>
                <th className="py-2 pr-3">Plan koszt</th>
                <th className="py-2 pr-3">Akcje</th>
              </tr>
            </thead>
            <tbody>
              {plans.map(p => (
                <tr key={p.id} className="border-b">
                  <td className="py-2 pr-3 font-mono">{p.family_key}</td>
                  <td className="py-2 pr-3">{p.stage_name ?? '—'}</td>
                  <td className="py-2 pr-3">{p.place_name ?? '—'}</td>
                  <td className="py-2 pr-3 font-mono">{fmtNum.format(p.planned_qty ?? 0)}</td>
                  <td className="py-2 pr-3 font-mono">
                    {p.planned_cost === null ? '—' : fmtCur.format(p.planned_cost)}
                  </td>
                  <td className="py-2 pr-3">
                    <form action={deleteDesignerPlan}>
                      <input type="hidden" name="id" value={p.id} />
                      <button className="px-2 py-1 border rounded text-xs">Usuń</button>
                    </form>
                  </td>
                </tr>
              ))}

              {plans.length === 0 && (
                <tr>
                  <td className="py-4 text-zinc-500" colSpan={6}>
                    Brak planów – dodaj pierwszy powyżej.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="text-xs text-zinc-500">
          Te dane są wykorzystywane w raporcie{' '}
          <a className="underline" href="/reports/plan-vs-reality">„Projektant vs rzeczywistość”</a>.
        </div>
      </section>
    </main>
  );
}
