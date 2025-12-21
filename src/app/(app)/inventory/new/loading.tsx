export default function Loading() {
    return (
      <div className="p-6">
        <div className="card p-4 space-y-3">
          <div className="text-sm font-semibold">Nowa inwentaryzacja</div>
          <div className="text-xs text-muted-foreground">Ładowanie formularza…</div>
  
          <div className="space-y-2">
            <div className="h-10 rounded-xl bg-card border border-border opacity-60" />
            <div className="h-24 rounded-xl bg-card border border-border opacity-50" />
            <div className="h-10 rounded-xl bg-card border border-border opacity-40" />
          </div>
        </div>
      </div>
    );
  }
  