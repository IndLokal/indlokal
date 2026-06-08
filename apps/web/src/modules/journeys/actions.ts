/**
 * Action-or-drop resolution — PRD/TDD-0052 §5, ADR-0011 §3.
 *
 * Every journey block must end in exactly one concrete next step. A candidate
 * that cannot resolve a meaningful action returns `null` and is dropped during
 * composition. These functions are pure (no I/O) so they are trivially testable.
 */
import { RESOURCE_TYPE_TO_SLUG } from '@/lib/config/resources';
import type { ResolvedResource } from '@/modules/resources';
import type { JourneyCommunityRow } from '@/modules/community';
import type { EventListItem } from '@/modules/event';
import type { JourneyActionDescriptor } from './types';

/**
 * Resources are always actionable: an official external link when present,
 * otherwise the on-platform guide page (anchored to the resource).
 */
export function resolveResourceAction(
  resource: Pick<ResolvedResource, 'url' | 'slug' | 'resourceType'>,
  citySlug: string,
): JourneyActionDescriptor {
  if (resource.url && resource.url.trim().length > 0) {
    return { kind: 'open_link', label: 'Open official site', href: resource.url, external: true };
  }
  const categorySlug = RESOURCE_TYPE_TO_SLUG[resource.resourceType] ?? 'all';
  return {
    kind: 'open_link',
    label: 'Read the guide',
    href: `/${citySlug}/resources/${categorySlug}#${resource.slug}`,
    external: false,
  };
}

/**
 * A community is only actionable when it exposes at least one verified join
 * channel. The action navigates to the on-platform community detail page (the
 * verified join hub), keeping users inside the trust layer. No channel → drop.
 */
export function resolveCommunityAction(
  community: Pick<JourneyCommunityRow, 'slug' | 'accessChannels'>,
  citySlug: string,
): JourneyActionDescriptor | null {
  const hasChannel = community.accessChannels.some((c) => c.url && c.url.trim().length > 0);
  if (!hasChannel) return null;
  return {
    kind: 'join',
    label: 'View & join',
    href: `/${citySlug}/communities/${community.slug}`,
    external: false,
  };
}

/**
 * Events always have a canonical detail page and are saveable, so they are
 * always actionable.
 */
export function resolveEventAction(
  event: Pick<EventListItem, 'slug'>,
  citySlug: string,
): JourneyActionDescriptor {
  return {
    kind: 'open_link',
    label: 'View event',
    href: `/${citySlug}/events/${event.slug}`,
    external: false,
  };
}
