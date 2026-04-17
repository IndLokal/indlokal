import { Skeleton, SkeletonGrid } from '@/components/ui';

export default function MeLoading() {
  return (
    <div className="space-y-8">
      {/* Profile header */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-14 w-14 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
      </div>
      {/* Content */}
      <Skeleton className="h-6 w-32" />
      <SkeletonGrid cols="sm:grid-cols-2" count={4} height="h-24" />
    </div>
  );
}
