'use client';

import { useOptimistic, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Events, useTrackEvent } from '@/lib/analytics';
import { toggleSaveResource } from '@/app/actions/saves';

type Props = {
  resourceId: string;
  resourceTitle?: string;
  saved: boolean;
  citySlug: string;
  sourceSurface: 'resources_journey' | 'resources_hub' | 'resources_category';
};
export function ResourceSaveButton({
  resourceId,
  resourceTitle,
  saved,
  citySlug,
  sourceSurface,
}: Props) {
  const router = useRouter();
  const track = useTrackEvent();
  const [isPending, startTransition] = useTransition();
  const [optimisticSaved, setOptimisticSaved] = useOptimistic(saved);

  function handleClick() {
    startTransition(async () => {
      setOptimisticSaved(!optimisticSaved);
      const result = await toggleSaveResource(resourceId, { sourceSurface });
      if ('requiresAuth' in result) {
        router.push('/me/login');
        return;
      }

      if ('saved' in result) {
        track(result.saved ? Events.RESOURCE_SAVED : Events.RESOURCE_UNSAVED, {
          resource_id: resourceId,
          resource_title: resourceTitle,
          city: citySlug,
          source_surface: sourceSurface,
        });
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-pressed={optimisticSaved}
      aria-label={
        resourceTitle
          ? `${optimisticSaved ? 'Unsave resource' : 'Save resource'}: ${resourceTitle}`
          : optimisticSaved
            ? 'Unsave resource'
            : 'Save resource'
      }
      className={
        optimisticSaved
          ? 'inline-flex min-h-10 items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 transition-colors'
          : 'text-muted hover:text-brand-700 inline-flex min-h-10 items-center gap-1 rounded-md border border-transparent px-2.5 py-1 text-[11px] font-medium transition-colors'
      }
    >
      <span aria-hidden>{optimisticSaved ? '★' : '☆'}</span>
      <span className="hidden sm:inline">{optimisticSaved ? 'Saved' : 'Save'}</span>
    </button>
  );
}
