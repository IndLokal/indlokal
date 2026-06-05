'use client';

import { useEffect, useRef } from 'react';
import { Events, useTrackEvent } from '@/lib/analytics';
import { ACTIVE_BUSINESS_CONNECT_PILOT } from './pilot';

/**
 * Fires a single `business_connect_page_view` analytics event on mount.
 * No sensitive data is captured.
 */
export function BusinessConnectPageView() {
  const track = useTrackEvent();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    track(Events.BUSINESS_CONNECT_PAGE_VIEW, { pilotSlug: ACTIVE_BUSINESS_CONNECT_PILOT.slug });
  }, [track]);

  return null;
}
