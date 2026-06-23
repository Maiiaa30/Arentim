/**
 * Skeleton placeholders for loading states — a shimmering block that mirrors the
 * shape of the real content, so pages feel instant instead of flashing
 * "A carregar…". Pure presentation; always aria-hidden.
 */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-surface-raised/60 ${className}`} aria-hidden />;
}

/** A stack of text-line skeletons; the last line is shorter for a natural look. */
export function SkeletonLines({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-3.5 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </div>
  );
}

/** A generic card-shaped skeleton (game tiles, panels). */
export function SkeletonCard({ className = 'h-40' }: { className?: string }) {
  return <Skeleton className={`w-full ${className}`} />;
}

/** A list-row skeleton: small avatar + two text lines + a trailing value. */
export function SkeletonRow({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 rounded-lg border border-border bg-surface/40 p-3 ${className}`} aria-hidden>
      <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3.5 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <Skeleton className="h-4 w-12 shrink-0" />
    </div>
  );
}
