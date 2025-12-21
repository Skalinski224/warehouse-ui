// src/app/(app)/analyze/metrics/loading.tsx
// Loading UI — “2026 vibe” skeleton dla całej strony metryk

export default function Loading() {
    return (
      <div className="space-y-4">
        {/* Topbar skeleton */}
        <div className="card p-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="h-4 w-44 rounded bg-background/40" />
              <div className="h-3 w-72 rounded bg-background/30" />
            </div>
  
            <div className="flex flex-wrap items-center gap-2">
              <div className="h-9 w-44 rounded-xl border border-border bg-background/30" />
              <div className="h-9 w-44 rounded-xl border border-border bg-background/30" />
              <div className="h-9 w-40 rounded-xl border border-border bg-background/30" />
              <div className="h-9 w-32 rounded-xl border border-border bg-background/30" />
            </div>
          </div>
        </div>
  
        {/* Main layout: left nav + content */}
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          {/* Left panel skeleton */}
          <div className="card p-3">
            <div className="h-3 w-28 rounded bg-background/30" />
            <div className="mt-3 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-10 rounded-xl border border-border bg-background/30"
                />
              ))}
            </div>
  
            <div className="mt-4 rounded-xl border border-border bg-background/20 p-3">
              <div className="h-3 w-40 rounded bg-background/30" />
              <div className="mt-2 h-3 w-56 rounded bg-background/20" />
              <div className="mt-2 h-3 w-44 rounded bg-background/20" />
            </div>
          </div>
  
          {/* Content skeleton */}
          <div className="space-y-4">
            {/* Status card */}
            <div className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="h-4 w-56 rounded bg-background/40" />
                  <div className="h-3 w-80 rounded bg-background/30" />
                </div>
                <div className="h-7 w-28 rounded-full border border-border bg-background/30" />
              </div>
  
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-10 rounded-xl border border-border bg-background/30"
                  />
                ))}
              </div>
            </div>
  
            {/* KPI grid */}
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="card p-3">
                  <div className="h-3 w-24 rounded bg-background/30" />
                  <div className="mt-2 h-6 w-28 rounded bg-background/40" />
                  <div className="mt-2 h-3 w-32 rounded bg-background/20" />
                </div>
              ))}
            </div>
  
            {/* Charts */}
            <div className="grid gap-2 lg:grid-cols-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="card p-3">
                  <div className="flex items-center justify-between">
                    <div className="h-3 w-40 rounded bg-background/30" />
                    <div className="h-7 w-20 rounded-full border border-border bg-background/30" />
                  </div>
                  <div className="mt-3 h-56 rounded-xl border border-border bg-background/30" />
                </div>
              ))}
            </div>
  
            {/* Top usage table */}
            <div className="card p-3">
              <div className="flex items-center justify-between">
                <div className="h-3 w-44 rounded bg-background/30" />
                <div className="h-7 w-24 rounded-full border border-border bg-background/30" />
              </div>
  
              <div className="mt-3 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-10 rounded-xl border border-border bg-background/30"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
  
        {/* Subtle “mission control” footer line */}
        <div className="mx-auto h-2 w-2 rounded-full bg-background/40" />
      </div>
    );
  }
  