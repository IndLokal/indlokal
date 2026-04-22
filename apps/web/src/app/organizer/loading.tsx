import { Skeleton, SkeletonGrid } from '@/components/ui';

export default function OrganizerLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-72" />
      <SkeletonGrid cols="sm:grid-cols-2 lg:grid-cols-3" count={3} height="h-28" />
      <Skeleton className="h-40 rounded-xl" />
    </div>
  );
}
