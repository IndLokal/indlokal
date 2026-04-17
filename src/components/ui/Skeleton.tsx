/**
 * Composable skeleton atoms for loading states using the new design system.
 */

type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className = 'h-4 w-full' }: SkeletonProps) {
  return <div className={`animate-pulse rounded bg-slate-200 ${className}`} />;
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-4 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = 'h-48' }: { className?: string }) {
  return <Skeleton className={`card-base !bg-slate-100 ${className}`} />;
}

type SkeletonGridProps = {
  /** Tailwind grid-cols class, e.g. "sm:grid-cols-2 lg:grid-cols-3" */
  cols?: string;
  count?: number;
  className?: string;
  height?: string; // Kept for backwards compatibility
};

export function SkeletonGrid({
  cols = 'sm:grid-cols-2 lg:grid-cols-3',
  count = 6,
  className,
  height = 'h-48',
}: SkeletonGridProps) {
  return (
    <div className={`grid gap-4 ${cols}`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} className={className || height} />
      ))}
    </div>
  );
}
