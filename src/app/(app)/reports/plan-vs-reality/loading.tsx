/**
 * Skeleton loading state
 * Designer vs Real dashboard
 *
 * UWAGA:
 * - zero logiki
 * - zero hooków
 * - zero danych
 * - tylko layout + shimmer
 */

export default function LoadingDesignerVsReal() {
    return (
      <div className="space-y-4 animate-pulse">
        {/* Filters bar */}
        <div className="card p-4 flex flex-wrap gap-3">
          <div className="h-8 w-40 rounded bg-muted" />
          <div className="h-8 w-32 rounded bg-muted" />
          <div className="h-8 w-32 rounded bg-muted" />
          <div className="ml-auto h-8 w-44 rounded bg-muted" />
        </div>
  
        {/* KPI tiles */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card p-4 space-y-3">
            <div className="h-4 w-32 rounded bg-muted" />
            <div className="h-8 w-24 rounded bg-muted" />
            <div className="h-3 w-48 rounded bg-muted" />
          </div>
  
          <div className="card p-4 space-y-3">
            <div className="h-4 w-32 rounded bg-muted" />
            <div className="h-8 w-24 rounded bg-muted" />
            <div className="h-3 w-48 rounded bg-muted" />
          </div>
  
          <div className="card p-4 space-y-3">
            <div className="h-4 w-32 rounded bg-muted" />
            <div className="h-8 w-24 rounded bg-muted" />
            <div className="h-3 w-48 rounded bg-muted" />
          </div>
        </div>
  
        {/* Tabs */}
        <div className="card p-2 flex gap-2">
          <div className="h-8 w-24 rounded bg-muted" />
          <div className="h-8 w-24 rounded bg-muted" />
          <div className="h-8 w-24 rounded bg-muted" />
          <div className="h-8 w-24 rounded bg-muted" />
        </div>
  
        {/* Main content placeholder */}
        <div className="card p-6 space-y-4">
          <div className="h-4 w-40 rounded bg-muted" />
          <div className="h-48 w-full rounded bg-muted" />
          <div className="h-32 w-full rounded bg-muted" />
        </div>
      </div>
    );
  }
  