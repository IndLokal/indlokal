'use client';

import { useEffect, useRef } from 'react';
import { Events } from '@/lib/analytics';
import { recordLastJourney } from './ContinueJourneyChip';

type Props = {
  citySlug: string;
  persona: string;
  personaSlug: string;
  blockCount: number;
  promoted: boolean;
  stages: string[];
};

/**
 * Fires `journey_view` once on mount and `journey_stage_view` as each stage
 * scrolls into view. Mirrors the BusinessLensTracker pattern (server-to-DB via
 * /api/v1/track + PostHog passthrough). Render once near the top of a journey
 * page with the stage section ids it should observe.
 */
export function JourneyViewTracker({
  citySlug,
  persona,
  personaSlug,
  blockCount,
  promoted,
  stages,
}: Props) {
  const seenStages = useRef<Set<string>>(new Set());

  useEffect(() => {
    recordLastJourney(citySlug, personaSlug);
    fetch('/api/v1/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: Events.JOURNEY_VIEW,
        entityType: 'RESOURCE',
        entityId: `journey:${personaSlug}`,
        citySlug,
        metadata: { persona, persona_slug: personaSlug, block_count: blockCount, promoted },
      }),
    }).catch(() => {});
  }, [citySlug, persona, personaSlug, blockCount, promoted]);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const stage = entry.target.getAttribute('data-journey-stage');
          if (!stage || !entry.isIntersecting || seenStages.current.has(stage)) continue;
          seenStages.current.add(stage);
          fetch('/api/v1/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: Events.JOURNEY_STAGE_VIEW,
              entityType: 'RESOURCE',
              entityId: `journey:${personaSlug}:${stage}`,
              citySlug,
              metadata: { persona, persona_slug: personaSlug, stage },
            }),
          }).catch(() => {});
        }
      },
      { threshold: 0.4 },
    );
    for (const stage of stages) {
      const el = document.querySelector(`[data-journey-stage="${stage}"]`);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [citySlug, persona, personaSlug, stages]);

  return null;
}
