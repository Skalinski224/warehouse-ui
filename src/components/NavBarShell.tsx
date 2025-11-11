export function NavBarShell({
    accountName,
    accountId,
  }: {
    accountName?: string | null;
    accountId?: string | null;
  }) {
    return (
      <header className="flex items-center justify-between p-3 border-b">
        <div className="text-sm opacity-70">
          {accountName ?? '—'}{' '}
          {accountId ? <span className="opacity-50">({accountId})</span> : null}
        </div>
        {/* UWAGA: żadnego formAction tutaj */}
        <button type="submit" className="rounded px-3 py-1 border text-sm">
          Wyloguj
        </button>
      </header>
    );
  }
  