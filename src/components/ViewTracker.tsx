'use client';

import { useEffect } from 'react';
import { Events, useTrackEvent, type AnalyticsEvent } from '@/lib/analytics';

type Props = {
  entityType: 'COMMUNITY' | 'EVENT';
  entityId: string;
  cityId: string;
  /** Slug for richer PostHog event properties */
  entitySlug?: string;
  city?: string;
};

const POSTHOG_EVENT_MAP: Record<string, AnalyticsEvent> = {
  COMMUNITY: Events.COMMUNITY_VIEWED,
  EVENT: Events.EVENT_VIEWED,
};

/**
 * Fires a non-blocking VIEW interaction when a community or event page is visited.
 * Records to both the database (for engagement scoring) and PostHog (for product analytics).
 */
export function ViewTracker({ entityType, entityId, cityId, entitySlug, city }: Props) {
  const track = useTrackEvent();

  useEffect(() => {
    // DB-backed view for scoring pipeline
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityType, entityId, cityId }),
    }).catch(() => {}); // fire-and-forget

    // PostHog event for product analytics
    const event = POSTHOG_EVENT_MAP[entityType];
    if (event) {
      track(event, {
        entity_id: entityId,
        entity_slug: entitySlug,
        city,
      });
    }
  }, [entityType, entityId, cityId, entitySlug, city, track]);

  return null;
}
