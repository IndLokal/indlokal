import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { getCommunityBySlug } from '@/modules/community/queries';
import { ClaimSection } from './ClaimSection';
import { ReportIssueForm } from '@/components/ReportIssueForm';
import { ViewTracker } from '@/components/ViewTracker';
import { ActivityBadge } from '@/components/ui';
import { AccessChannelLink } from '@/components/AccessChannelLink';

/**
 * Community Detail Page
 *
 * Route: /[city]/communities/[slug]/
 * Example: /stuttgart/communities/hss-stuttgart/
 */

type Props = { params: Promise<{ city: string; slug: string }> };

const CHANNEL_ICONS: Record<string, string> = {
  WHATSAPP: '💬',
  TELEGRAM: '✈️',
  WEBSITE: '🌐',
  FACEBOOK: '📘',
  INSTAGRAM: '📸',
  EMAIL: '✉️',
  MEETUP: '🤝',
  YOUTUBE: '▶️',
  LINKEDIN: '💼',
  OTHER: '🔗',
};

const CHANNEL_LABELS: Record<string, string> = {
  WHATSAPP: 'WhatsApp',
  TELEGRAM: 'Telegram',
  WEBSITE: 'Website',
  FACEBOOK: 'Facebook',
  INSTAGRAM: 'Instagram',
  EMAIL: 'Email',
  MEETUP: 'Meetup',
  YOUTUBE: 'YouTube',
  LINKEDIN: 'LinkedIn',
  OTHER: 'Link',
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const community = await getCommunityBySlug(slug);
  if (!community) return { title: 'Community not found' };
  return {
    title: `${community.name} — Indian Community in ${community.city.name}`,
    description:
      community.description ??
      `${community.name} — Indian community in ${community.city.name}, Germany.`,
  };
}

export default async function CommunityDetailPage({ params }: Props) {
  const { city, slug } = await params;
  const community = await getCommunityBySlug(slug);
  if (!community) notFound();

  const now = new Date();
  const upcomingEvents = community.events.filter((e) => new Date(e.startsAt) >= now);
  const pastEvents = community.events.filter((e) => new Date(e.startsAt) < now);

  // JSON-LD Organization schema
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: community.name,
    description: community.description ?? undefined,
    foundingDate: community.foundedYear?.toString(),
    url: community.accessChannels.find((c) => c.channelType === 'WEBSITE')?.url,
    location: {
      '@type': 'Place',
      addressLocality: community.city.name,
      addressCountry: 'DE',
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ViewTracker
        entityType="COMMUNITY"
        entityId={community.id}
        cityId={community.city.id}
        entitySlug={community.slug}
        city={city}
      />

      <div className="mx-auto max-w-2xl space-y-10">
        {/* Breadcrumb */}
        <nav className="text-muted text-sm">
          <Link
            href={`/${city}`}
            className="hover:text-foreground transition-colors hover:underline"
          >
            {community.city.name}
          </Link>
          {' / '}
          <Link
            href={`/${city}/communities`}
            className="hover:text-foreground transition-colors hover:underline"
          >
            Communities
          </Link>
          {' / '}
          <span className="text-foreground">{community.name}</span>
        </nav>

        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="bg-brand-100 text-brand-700 flex h-16 w-16 shrink-0 items-center justify-center rounded-[var(--radius-panel)] text-2xl font-bold">
            {community.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={community.logoUrl}
                alt={community.name}
                className="h-16 w-16 rounded-[var(--radius-panel)] object-cover"
              />
            ) : (
              community.name.charAt(0)
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">{community.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <ActivityBadge score={community.activityScore ?? 0} />
              {community.foundedYear && (
                <span className="text-muted text-sm">Est. {community.foundedYear}</span>
              )}
              {community.memberCountApprox && (
                <span className="text-muted text-sm">
                  ~{community.memberCountApprox.toLocaleString()} members
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Categories */}
        {community.categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {community.categories.map(({ category }) => (
              <span
                key={category.slug}
                className="badge-base bg-brand-50 text-brand-700 ring-brand-600/10 px-3 py-1 text-sm ring-1 ring-inset"
              >
                {category.icon} {category.name}
              </span>
            ))}
          </div>
        )}

        {/* Description */}
        {(community.description || community.descriptionLong) && (
          <div>
            <h2 className="text-lg font-semibold">About</h2>
            <p className="text-muted mt-2 leading-relaxed whitespace-pre-line">
              {community.descriptionLong ?? community.description}
            </p>
          </div>
        )}

        {/* Languages */}
        {community.languages && community.languages.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold">Languages</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {community.languages.map((lang) => (
                <span
                  key={lang}
                  className="badge-base bg-muted-bg text-foreground px-3 py-1 text-sm"
                >
                  {lang}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Access Channels */}
        {community.accessChannels.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold">Join this community</h2>
            <div className="mt-3 flex flex-wrap gap-3">
              {community.accessChannels.map((ch) => (
                <AccessChannelLink
                  key={ch.id}
                  href={ch.url}
                  channelType={ch.channelType}
                  channelLabel={ch.label ?? CHANNEL_LABELS[ch.channelType] ?? ch.channelType}
                  channelIcon={CHANNEL_ICONS[ch.channelType] ?? '🔗'}
                  communityId={community.id}
                  communitySlug={community.slug}
                  city={city}
                  isPrimary={ch.isPrimary}
                />
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Events */}
        {upcomingEvents.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold">Upcoming Events</h2>
            <div className="mt-3 space-y-3">
              {upcomingEvents.map((event) => (
                <Link
                  key={event.id}
                  href={`/${city}/events/${event.slug}`}
                  className="card-base flex items-center justify-between p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div>
                    <p className="text-foreground font-medium">{event.title}</p>
                    <p className="text-muted mt-0.5 text-sm">
                      {format(new Date(event.startsAt), 'EEE, MMM d · h:mm a')}
                      {event.venueName && ` · ${event.venueName}`}
                    </p>
                  </div>
                  <span className="text-muted ml-4 shrink-0">→</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Past Events */}
        {pastEvents.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold">Past Events</h2>
            <p className="text-muted mt-1 text-sm">
              Track record: {pastEvents.length} event{pastEvents.length !== 1 ? 's' : ''} hosted
            </p>
            <div className="mt-3 space-y-2">
              {pastEvents.slice(0, 5).map((event) => (
                <Link
                  key={event.id}
                  href={`/${city}/events/${event.slug}`}
                  className="border-border/50 bg-muted-bg flex items-center justify-between rounded-[var(--radius-card)] border p-3 text-sm transition-colors hover:bg-slate-200"
                >
                  <div>
                    <p className="text-foreground font-medium">{event.title}</p>
                    <p className="text-muted mt-0.5 text-xs">
                      {format(new Date(event.startsAt), 'MMM d, yyyy')}
                      {event.venueName && ` · ${event.venueName}`}
                    </p>
                  </div>
                  <span className="text-muted ml-4 shrink-0">→</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Claim Section */}
        <ClaimSection
          communityId={community.id}
          communityName={community.name}
          claimState={community.claimState}
        />

        {/* Report an issue */}
        <ReportIssueForm communityId={community.id} />
      </div>
    </>
  );
}
