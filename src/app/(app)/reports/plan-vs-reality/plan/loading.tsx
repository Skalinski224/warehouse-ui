export default function Loading() {
    return (
      <div className="space-y-4">
        <div className="card p-4">
          <div className="h-4 w-40 bg-foreground/10 rounded" />
          <div className="mt-2 h-3 w-72 bg-foreground/10 rounded" />
        </div>
  
        <div className="card p-4 space-y-3">
          <div className="h-4 w-48 bg-foreground/10 rounded" />
          <div className="h-9 w-full bg-foreground/10 rounded" />
          <div className="h-9 w-full bg-foreground/10 rounded" />
          <div className="h-9 w-32 bg-foreground/10 rounded" />
        </div>
  
        <div className="card p-4">
          <div className="h-40 w-full bg-foreground/10 rounded" />
        </div>
      </div>
    );
  }
  