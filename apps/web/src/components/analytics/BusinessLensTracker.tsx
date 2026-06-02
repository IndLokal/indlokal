'use client';

import { useEffect } from 'react';
import { Events } from '@/lib/analytics';

type Props = {
  city: string;
  surface: 'events_page' | 'business_events_page';
  resultCount?: number;
};

/**
 * Tracks entry into the business-and-careers discovery lens.
 */
export function BusinessLensTracker({ city, surface, resultCount }: Props) {
  useEffect(() => {
    const metadata = {
      lens_context: 'business_careers',
      result_count: resultCount,
    };

    fetch('/api/v1/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: Events.BUSINESS_LENS_VIEWED,
        entityType: 'RESOURCE',
        entityId: 'business_lens',
        citySlug: city,
        metadata: { surface, ...metadata },
      }),
    }).catch(() => {});
  }, [city, surface, resultCount]);

  return null;
}
