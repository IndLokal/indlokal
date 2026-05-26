'use client';

import { useEffect } from 'react';
import { Events, useTrackEvent } from '@/lib/analytics';

type Props = {
  city: string;
  surface: 'events_page' | 'business_events_page';
};

/**
 * Tracks entry into the business-and-careers discovery lens.
 */
export function BusinessLensTracker({ city, surface }: Props) {
  const track = useTrackEvent();

  useEffect(() => {
    track(Events.BUSINESS_LENS_VIEWED, {
      city,
      surface,
      lens_context: 'business_careers',
    });
  }, [city, surface, track]);

  return null;
}
