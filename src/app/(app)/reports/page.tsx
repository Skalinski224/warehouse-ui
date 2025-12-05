import Link from "next/link";

const cards = [
  { href: "/reports/deliveries", title: "Raport o dostawach", desc: "Dostawy, statusy, koszty" },
  { href: "/reports/daily", title: "Raporty dzienne", desc: "Zużycie materiałów wg brygad" },
  { href: "/reports/stages", title: "Etap projektu", desc: "Postęp prac per etap" },
  { href: "/reports/items", title: "Wszystkie przedmioty", desc: "Stan, historia, rotacja" },
  { href: "/reports/plan-vs-reality", title: "Projektant vs rzeczywistość", desc: "Założenia vs wykonanie" },
  { href: "/reports/project-metrics", title: "Projekt w liczbach", desc: "KPI, metryki, wykresy" },
];

export default function Page() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Raporty</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className="block border rounded-lg p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900">
            <div className="text-lg font-medium">{c.title}</div>
            <div className="text-sm text-gray-500 mt-1">{c.desc}</div>
          </Link>
        ))}
      </div>
    </main>
  );
}
