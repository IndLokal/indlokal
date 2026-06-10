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
};

export function ResourcesTrackedLink({
  href,
  event,
  properties,
  className,
  children,
}: TrackedLinkProps) {
  const track = useTrackEvent();

  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        track(event, properties);
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
