import { Skeleton, SkeletonGrid } from '@/components/ui';

export default function AdminLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-96" />
      <SkeletonGrid cols="sm:grid-cols-2 lg:grid-cols-3" count={6} height="h-24" />
    </div>
  );
}
