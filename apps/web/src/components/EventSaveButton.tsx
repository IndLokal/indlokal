'use client';

import { useOptimistic, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Events, useTrackEvent } from '@/lib/analytics';
import { toggleSaveEvent } from '@/app/actions/saves';

type Props = {
  eventId: string;
  saved: boolean;
  city?: string;
  lensContext?: 'business_careers';
};

export function EventSaveButton({ eventId, saved, city, lensContext }: Props) {
  const router = useRouter();
  const track = useTrackEvent();
  const [isPending, startTransition] = useTransition();
  const [optimisticSaved, setOptimisticSaved] = useOptimistic(saved);

  function handleClick() {
    startTransition(async () => {
      setOptimisticSaved(!optimisticSaved);
      const result = await toggleSaveEvent(eventId, lensContext ? { lensContext } : undefined);
      if ('requiresAuth' in result) {
        router.push('/me/login');
        return;
      }
      if ('saved' in result) {
        const metadata = lensContext ? { lens_context: lensContext } : undefined;
        track(result.saved ? Events.EVENT_SAVED : Events.EVENT_UNSAVED, {
          event_id: eventId,
          city,
          ...metadata,
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
      className={`rounded-[var(--radius-button)] px-4 py-2 text-sm font-semibold transition-colors ${
        optimisticSaved
          ? 'bg-brand-700 hover:bg-brand-800 text-white'
          : 'bg-brand-600 hover:bg-brand-700 text-white'
      }`}
    >
      {optimisticSaved ? 'Saved' : 'Save'}
    </button>
  );
}
