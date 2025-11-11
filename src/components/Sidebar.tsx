'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/', label: 'Dashboard' },
  { href: '/low-stock', label: 'Co się kończy' },
  { href: '/deliveries', label: 'Nowe dostawy' },
  { href: '/materials', label: 'Katalog materiałów' },
  { href: '/daily-reports', label: 'Dzienne zużycie' },
  { href: '/reports', label: 'Raporty' },
  { href: '/team', label: 'Zespół' },
  { href: '/object', label: 'Obiekt' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="p-3 space-y-1">
      <div className="px-3 py-2 text-sm font-semibold opacity-80">Warehouse UI</div>
      {items.map((it) => {
        const active = pathname === it.href || pathname?.startsWith(it.href + '/');
        return (
          <Link
            key={it.href}
            href={it.href}
            className={[
              'block px-3 py-2 rounded-xl transition',
              active
                ? 'bg-background text-foreground border border-border'
                : 'text-foreground/70 hover:text-foreground hover:bg-background/40'
            ].join(' ')}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
