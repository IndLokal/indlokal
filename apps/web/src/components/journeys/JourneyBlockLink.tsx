'use client';

import Link from 'next/link';
import { Events } from '@/lib/analytics';

type Props = {
  href: string;
  label: string;
  external: boolean;
  citySlug: string;
  personaSlug: string;
  entityKind: string;
  entityId: string | null;
  stage: string;
  className?: string;
};

/**
 * The action button that ends every journey block. Tracks `journey_block_action`
 * (fire-and-forget) before letting the navigation proceed. Internal links use
 * Next's client router; external links open in a new tab.
 */
export function JourneyBlockLink({
  href,
  label,
  external,
  citySlug,
  personaSlug,
  entityKind,
  entityId,
  stage,
  className,
}: Props) {
  const track = () => {
    fetch('/api/v1/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: Events.JOURNEY_BLOCK_ACTION,
        entityType:
          entityKind === 'community' ? 'COMMUNITY' : entityKind === 'event' ? 'EVENT' : 'RESOURCE',
        entityId: entityId ?? `journey:${personaSlug}:${stage}`,
        citySlug,
        metadata: { persona_slug: personaSlug, entity_kind: entityKind, stage, external },
      }),
    }).catch(() => {});
  };

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer nofollow"
        onClick={track}
        className={className}
      >
        {label} ↗
      </a>
    );
  }

  return (
    <Link href={href} onClick={track} className={className}>
      {label} →
    </Link>
  );
}
