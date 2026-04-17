'use client';

import { Events, useTrackEvent } from '@/lib/analytics';

type Props = {
  href: string;
  channelType: string;
  channelLabel: string;
  channelIcon: string;
  communityId: string;
  communitySlug: string;
  city: string;
  isPrimary: boolean;
};

/**
 * Renders a community access channel link and fires a PostHog
 * `community_access_clicked` event before opening the external URL.
 */
export function AccessChannelLink({
  href,
  channelType,
  channelLabel,
  channelIcon,
  communityId,
  communitySlug,
  city,
  isPrimary,
}: Props) {
  const track = useTrackEvent();

  function handleClick() {
    track(Events.COMMUNITY_ACCESS_CLICKED, {
      community_id: communityId,
      community_slug: communitySlug,
      channel_type: channelType.toLowerCase(),
      city,
      is_primary: isPrimary,
    });
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className="card-base text-foreground inline-flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <span className="text-lg">{channelIcon}</span>
      {channelLabel}
      {isPrimary && (
        <span className="badge-base bg-brand-50 text-brand-600 ml-1 px-2 py-0.5 text-xs">
          Primary
        </span>
      )}
    </a>
  );
}
