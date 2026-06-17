'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Events, useTrackEvent } from '@/lib/analytics';
import type { ReactNode } from 'react';

type TrackingProps = {
  city: string;
  persona?: string;
  intent?: string;
  variant?: string;
  ctaEnabled?: boolean;
};

function persistTrack(payload: Record<string, unknown>): void {
  fetch('/api/v1/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

export function ResourcesHubViewTracking({
  city,
  persona,
  intent,
  variant = 'control',
  ctaEnabled = true,
}: TrackingProps) {
  const track = useTrackEvent();

  useEffect(() => {
    track(Events.RESOURCES_HUB_VIEW, { city, persona, intent, variant });
    persistTrack({
      event: Events.RESOURCES_HUB_VIEW,
      entityType: 'RESOURCE',
      entityId: `resources_hub:${city}`,
      citySlug: city,
      metadata: { persona, intent, variant, source_surface: 'resources_hub' },
    });
    track(Events.RESOURCES_EXPERIMENT_VARIANT_ASSIGNED, {
      city,
      variant,
      module: 'resources_hub',
    });
    if (ctaEnabled) {
      track(Events.RESOURCE_CTA_VARIANT_ASSIGNED, {
        city,
        variant: 'action_first_v1',
        module: 'resources_hub',
      });
      track(Events.RESOURCE_CTA_IMPRESSION, {
        city,
        cta_surface: 'resources_hub',
        cta_position: 'primary',
        variant: 'action_first_v1',
      });
    }
    track(Events.RESOURCES_TRUST_BADGE_IMPRESSION, { city, surface: 'resources_hub' });
  }, [city, persona, intent, variant, ctaEnabled, track]);

  return null;
}

type TrackedLinkProps = {
  href: string;
  event: (typeof Events)[keyof typeof Events];
  properties?: Record<string, unknown>;
  className?: string;
  children: ReactNode;
  persistEntityType?: 'RESOURCE' | 'EVENT' | 'COMMUNITY';
  persistEntityId?: string;
};

export function ResourcesTrackedLink({
  href,
  event,
  properties,
  className,
  children,
  persistEntityType,
  persistEntityId,
}: TrackedLinkProps) {
  const track = useTrackEvent();

  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        track(event, properties);
        if (persistEntityType && persistEntityId) {
          persistTrack({
            event,
            entityType: persistEntityType,
            entityId: persistEntityId,
            citySlug: typeof properties?.city === 'string' ? properties.city : undefined,
            metadata: { ...(properties ?? {}), source_event: event },
          });
        }
        if (properties?.is_stale === true) {
          track(Events.RESOURCES_STALE_ITEM_OPENED, properties);
        }
        if (event !== Events.RESOURCES_FIRST_MEANINGFUL_ACTION) {
          track(Events.RESOURCES_FIRST_MEANINGFUL_ACTION, {
            ...properties,
            source_event: event,
          });
        }
      }}
    >
      {children}
    </Link>
  );
}
