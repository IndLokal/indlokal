'use client';

import { useEffect } from 'react';
import { Events, useTrackEvent } from '@/lib/analytics';

type Props = {
  query: string;
  city: string;
  resultsCount: number;
};

/**
 * Fires a PostHog search_performed event when a search page loads.
 * Zero-result searches are captured via the `results_count: 0` property
 * rather than a separate event, keeping the event model clean.
 */
export function SearchTracker({ query, city, resultsCount }: Props) {
  const track = useTrackEvent();

  useEffect(() => {
    if (!query) return;
    track(Events.SEARCH_PERFORMED, {
      query,
      city,
      results_count: resultsCount,
      has_results: resultsCount > 0,
    });
  }, [query, city, resultsCount, track]);

  return null;
}
