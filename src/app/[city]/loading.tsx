import { SectionHeader } from '@/components/ui';
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';

export default function CityFeedLoading() {
  return (
    <div className="space-y-12">
      {/* Hero Skeleton */}
      <section>
        <Skeleton className="h-10 w-64 bg-slate-200" />
        <Skeleton className="mt-4 h-5 w-48 bg-slate-200" />
      </section>

      {/* This Week Skeleton */}
      <section className="space-y-4">
        <SectionHeader title="This Week" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <EventCardSkeleton key={`event-${i}`} />
          ))}
        </div>
      </section>

      {/* Categories Skeleton */}
      <section className="space-y-4">
        <SectionHeader title="Browse by Category" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={`cat-${i}`} className="h-32 !rounded-xl" />
          ))}
        </div>
      </section>

      {/* Active Communities Skeleton */}
      <section className="space-y-4">
        <SectionHeader title="Active Communities" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CommunityCardSkeleton key={`comm-${i}`} />
          ))}
        </div>
      </section>
    </div>
  );
}

function EventCardSkeleton() {
  return (
    <div className="card-base flex h-[210px] animate-pulse flex-col bg-slate-50/50 p-5">
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-10 !rounded-xl bg-slate-200" />
        <Skeleton className="h-4 w-28 bg-slate-200" />
      </div>
      <Skeleton className="mt-5 h-6 w-3/4 bg-slate-200" />
      <Skeleton className="mt-2 h-4 w-1/2 bg-slate-200" />
      <div className="border-border/50 mt-auto flex items-center justify-between border-t pt-4">
        <Skeleton className="h-4 w-1/3 bg-slate-200" />
        <Skeleton className="!rounded-badge h-6 w-16 bg-slate-200" />
      </div>
    </div>
  );
}

function CommunityCardSkeleton() {
  return (
    <div className="card-base flex h-[280px] animate-pulse flex-col bg-slate-50/50 p-5">
      <div className="flex items-start justify-between">
        <Skeleton className="h-12 w-12 !rounded-full bg-slate-200" />
        <Skeleton className="!rounded-badge h-6 w-20 bg-slate-200" />
      </div>
      <Skeleton className="mt-5 h-6 w-2/3 bg-slate-200" />
      <Skeleton className="mt-3 h-4 w-full bg-slate-200" />
      <Skeleton className="mt-2 h-4 w-4/5 bg-slate-200" />
      <div className="mt-5 flex gap-2">
        <Skeleton className="!rounded-badge h-6 w-16 bg-slate-200" />
        <Skeleton className="!rounded-badge h-6 w-20 bg-slate-200" />
      </div>
      <div className="border-border/50 mt-auto border-t pt-5">
        <Skeleton className="h-4 w-1/2 bg-slate-200" />
      </div>
    </div>
  );
}
