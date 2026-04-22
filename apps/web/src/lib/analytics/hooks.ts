/**
 * Centralized analytics module — single source of truth for PostHog event names,
 * client-side tracking helpers, and user identity management.
 *
 * Usage (client components):
 *   import { Events, useTrackEvent } from '@/lib/analytics';
 *   const track = useTrackEvent();
 *   track(Events.COMMUNITY_SAVED, { community_id: '...' });
 *
 * Usage (server actions / API routes):
 *   import { Events } from '@/lib/analytics/events';
 *   import { captureServerEvent } from '@/lib/analytics/server';
 *   await captureServerEvent(userId, Events.USER_SIGNED_UP, { ... });
 */

'use client';

import { usePostHog } from 'posthog-js/react';
import { useCallback } from 'react';
import type { AnalyticsEvent } from './events';

// Re-export event constants so client components only need one import
export { Events, type AnalyticsEvent } from './events';

// ─── Client-side Tracking Hook ───────────────────────────────────────────────

/**
 * Returns a stable `track(event, properties?)` function.
 * No-ops gracefully when PostHog is not loaded.
 */
export function useTrackEvent() {
  const posthog = usePostHog();

  return useCallback(
    (event: AnalyticsEvent, properties?: Record<string, unknown>) => {
      posthog?.capture(event, properties);
    },
    [posthog],
  );
}
