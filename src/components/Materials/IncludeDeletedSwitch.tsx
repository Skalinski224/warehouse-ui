'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * IncludeDeletedSwitch — przełącznik między katalogiem i historią usuniętych.
 * - Jeśli jesteś na /materials → pokazuje link do /materials/deleted
 * - Jeśli jesteś na /materials/deleted → pokazuje link powrotny do /materials
 */
export default function IncludeDeletedSwitch({ className = '' }: { className?: string }) {
  const pathname = usePathname();
  const onDeletedPage = pathname?.startsWith('/materials/deleted');

  if (onDeletedPage) {
    return (
      <Link
        href="/materials"
        className={[
          'inline-flex items-center gap-1 px-3 py-2 rounded border border-border bg-card hover:bg-card/80 text-sm transition',
          className,
        ].join(' ')}
      >
        ← Wróć do katalogu
      </Link>
    );
  }

  return (
    <Link
      href="/materials/deleted"
      className={[
        'inline-flex items-center gap-1 px-3 py-2 rounded border border-border bg-card hover:bg-card/80 text-sm transition',
        className,
      ].join(' ')}
    >
      🗑️ Historia usuniętych
    </Link>
  );
}
