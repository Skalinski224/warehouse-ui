export default function Loading() {
    return (
      <div className="p-6">
        <div className="card p-4 space-y-3">
          <div className="text-sm font-semibold">Podsumowanie</div>
          <div className="text-xs text-muted-foreground">Liczenie różnic…</div>
  
          <div className="space-y-2">
            <div className="h-16 rounded-xl bg-card border border-border opacity-60" />
            <div className="h-24 rounded-xl bg-card border border-border opacity-50" />
          </div>
        </div>
      </div>
    );
  }
  