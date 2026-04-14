'use client';

import { useEffect } from 'react';

type Props = {
  entityType: 'COMMUNITY' | 'EVENT';
  entityId: string;
  cityId: string;
};

/**
 * Fires a non-blocking VIEW interaction when a community or event page is visited.
 * Used to feed the engagement scoring pipeline.
 */
export function ViewTracker({ entityType, entityId, cityId }: Props) {
  useEffect(() => {
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityType, entityId, cityId }),
    }).catch(() => {}); // fire-and-forget — failure is non-critical
  }, [entityType, entityId, cityId]);

  return null;
}
