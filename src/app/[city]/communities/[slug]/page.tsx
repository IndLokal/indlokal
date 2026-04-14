import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { getCommunityBySlug } from '@/modules/community/queries';
import { ClaimSection } from './ClaimSection';
import { ReportIssueForm } from '@/components/ReportIssueForm';
import { ViewTracker } from '@/components/ViewTracker';

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

function ActivityBadge({ score }: { score: number }) {
  const level =
    score >= 80
      ? { label: 'Very Active', cls: 'bg-green-100 text-green-700' }
      : score >= 60
        ? { label: 'Active', cls: 'bg-blue-100 text-blue-700' }
        : score >= 40
          ? { label: 'Moderate', cls: 'bg-yellow-100 text-yellow-700' }
          : { label: 'Low activity', cls: 'bg-gray-100 text-gray-500' };
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${level.cls}`}
    >
      {level.label}
    </span>
  );
}

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
      <ViewTracker entityType="COMMUNITY" entityId={community.id} cityId={community.city.id} />

      <div className="mx-auto max-w-2xl space-y-10">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500">
          <a href={`/${city}`} className="hover:underline">
            {community.city.name}
          </a>
          {' / '}
          <a href={`/${city}/communities`} className="hover:underline">
            Communities
          </a>
          {' / '}
          <span className="text-gray-700">{community.name}</span>
        </nav>

        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-2xl font-bold text-indigo-700">
            {community.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={community.logoUrl}
                alt={community.name}
                className="h-16 w-16 rounded-2xl object-cover"
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
                <span className="text-sm text-gray-500">Est. {community.foundedYear}</span>
              )}
              {community.memberCountApprox && (
                <span className="text-sm text-gray-500">
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
                className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700"
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
            <p className="mt-2 leading-relaxed whitespace-pre-line text-gray-700">
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
                  className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700"
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
                <a
                  key={ch.id}
                  href={ch.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-800 shadow-sm transition-shadow hover:shadow-md"
                >
                  <span className="text-lg">{CHANNEL_ICONS[ch.channelType] ?? '🔗'}</span>
                  {ch.label ?? CHANNEL_LABELS[ch.channelType] ?? ch.channelType}
                  {ch.isPrimary && (
                    <span className="ml-1 rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-600">
                      Primary
                    </span>
                  )}
                </a>
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
                <a
                  key={event.id}
                  href={`/${city}/events/${event.slug}`}
                  className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md"
                >
                  <div>
                    <p className="font-medium text-gray-900">{event.title}</p>
                    <p className="mt-0.5 text-sm text-gray-500">
                      {format(new Date(event.startsAt), 'EEE, MMM d · h:mm a')}
                      {event.venueName && ` · ${event.venueName}`}
                    </p>
                  </div>
                  <span className="ml-4 shrink-0 text-gray-400">→</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Past Events */}
        {pastEvents.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold">Past Events</h2>
            <p className="mt-1 text-sm text-gray-500">
              Track record: {pastEvents.length} event{pastEvents.length !== 1 ? 's' : ''} hosted
            </p>
            <div className="mt-3 space-y-2">
              {pastEvents.slice(0, 5).map((event) => (
                <a
                  key={event.id}
                  href={`/${city}/events/${event.slug}`}
                  className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm transition-shadow hover:shadow-sm"
                >
                  <div>
                    <p className="font-medium text-gray-700">{event.title}</p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {format(new Date(event.startsAt), 'MMM d, yyyy')}
                      {event.venueName && ` · ${event.venueName}`}
                    </p>
                  </div>
                  <span className="ml-4 shrink-0 text-gray-300">→</span>
                </a>
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
