import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCityFeed } from '@/modules/discovery';
import { CommunityCard } from '@/components/CommunityCard';
import { EventCard } from '@/components/EventCard';
import { getSessionUser } from '@/lib/session';
import { SectionHeader } from '@/components/ui';
import { UPCOMING_CITIES, getConfiguredCityName } from '@/lib/config';

/**
 * City Feed - the primary discovery surface.
 * Activity-led, not directory-led.
 */

type CityFeedPageProps = {
  params: Promise<{ city: string }>;
};

export async function generateMetadata({ params }: CityFeedPageProps): Promise<Metadata> {
  const { city } = await params;
  const cityName = getConfiguredCityName(city) ?? city.charAt(0).toUpperCase() + city.slice(1);
  return {
    title: `Indian Communities & Events in ${cityName}`,
    description: `What's happening for Indians in ${cityName} this week? Discover communities, events, and activities.`,
  };
}

export default async function CityFeedPage({ params }: CityFeedPageProps) {
  const { city } = await params;

  // Upcoming cities → redirect to their coming-soon page
  if (UPCOMING_CITIES.some((c) => c.slug === city)) {
    redirect(`/${city}/coming-soon`);
  }

  const [feed, user] = await Promise.all([getCityFeed(city), getSessionUser()]);
  if (!feed) notFound();
  const savedCommunityIds = new Set(
    user?.savedCommunities.map((s: { communityId: string }) => s.communityId) ?? [],
  );

  const {
    city: cityData,
    thisWeek,
    activeCommunities,
    recentPastEvents,
    categories,
    counts,
  } = feed;
  const cityName = cityData.name;
  const upcomingCount = thisWeek.events.length;
  const noUpcomingEvents = upcomingCount === 0;
  const lowUpcomingEvents = upcomingCount > 0 && upcomingCount <= 3;
  const hasUpcomingLater = noUpcomingEvents && counts.upcomingEvents > 0;
  type ThisWeekEvent = (typeof thisWeek.events)[number];
  type RecentPastEvent = (typeof recentPastEvents)[number];
  type CategoryItem = (typeof categories)[number];
  type ActiveCommunity = (typeof activeCommunities)[number];

  // Category card palette - brand indigo with a saffron alternate per design system.
  const CAT_COLORS = [
    'from-brand-400 to-brand-600',
    'from-brand-500 to-brand-700',
    'from-accent-400 to-accent-600',
    'from-brand-600 to-brand-800',
    'from-accent-300 to-accent-500',
    'from-brand-500 to-brand-700',
    'from-accent-400 to-accent-600',
    'from-brand-400 to-brand-600',
    'from-brand-600 to-brand-800',
  ];

  return (
    <div className="space-y-14">
      {/* Hero - dark, bold */}
      <section className="relative -mx-4 -mt-8 overflow-hidden sm:-mx-6 sm:-mt-12 lg:-mx-8">
        <div className="from-brand-900 via-brand-800 to-brand-700 bg-gradient-to-br px-4 pb-8 pt-10 sm:px-6 lg:px-8">
          <div className="pointer-events-none absolute inset-0">
            <div className="bg-brand-500/10 absolute -right-20 -top-20 hidden h-80 w-80 rounded-full blur-3xl sm:block" />
            <div className="bg-accent-400/5 absolute -left-20 bottom-0 hidden h-60 w-60 rounded-full blur-3xl sm:block" />
          </div>
          <div className="relative">
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              What&apos;s happening for Indians in {cityName}
            </h1>
            <div className="mt-3 flex items-center gap-4 text-sm">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 font-medium text-white/90 backdrop-blur-sm">
                <span className="flex h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                {counts.communities} communities
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 font-medium text-white/90 backdrop-blur-sm">
                📅 {counts.upcomingEvents} upcoming events
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* This Week / Month */}
      <section className="space-y-5">
        <SectionHeader
          title={thisWeek.expandedTo30Days ? 'Next 30 Days' : 'This Week'}
          action={{
            label: noUpcomingEvents
              ? hasUpcomingLater
                ? 'See upcoming events'
                : 'Suggest a listing'
              : 'See all events',
            href: noUpcomingEvents
              ? hasUpcomingLater
                ? `/${city}/events`
                : `/${city}/suggest`
              : `/${city}/events`,
          }}
        />
        {noUpcomingEvents ? (
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-[1.35fr,1fr]">
              <div className="border-brand-200 bg-brand-50/30 rounded-[var(--radius-panel)] border border-dashed px-6 py-8">
                <div className="ring-border/50 flex h-12 w-12 items-center justify-center rounded-xl bg-white text-2xl shadow-sm ring-1">
                  📆
                </div>
                <h3 className="text-foreground mt-4 text-lg font-semibold">
                  Quiet stretch in {cityName}
                </h3>
                <p className="text-muted mt-1 text-sm leading-relaxed">
                  {hasUpcomingLater
                    ? `No major public events are listed in the next 30 days. ${counts.upcomingEvents} upcoming event${counts.upcomingEvents !== 1 ? 's are' : ' is'} already listed for later dates.`
                    : 'No major public events are listed right now, but community activity continues through private meetups and ongoing groups.'}
                </p>
                <div className="mt-4 flex flex-wrap gap-2.5">
                  <Link
                    href={hasUpcomingLater ? `/${city}/events` : `/${city}/communities`}
                    className="btn-primary px-4 py-2 text-sm"
                  >
                    {hasUpcomingLater ? 'View upcoming events' : 'Browse communities'}
                  </Link>
                  <Link
                    href={`/${city}/suggest`}
                    className="text-brand-700 bg-white px-4 py-2 text-sm font-semibold ring-1 ring-black/[0.08] transition-colors hover:bg-black/[0.02]"
                  >
                    {hasUpcomingLater ? 'Suggest another listing' : 'Suggest a listing'}
                  </Link>
                </div>
              </div>

              <div className="rounded-[var(--radius-panel)] bg-white p-5 shadow-sm ring-1 ring-black/[0.06]">
                <h4 className="text-foreground text-sm font-semibold">City Pulse</h4>
                <p className="text-muted mt-1 text-xs">Communities active this week</p>
                <div className="mt-3 space-y-2.5">
                  {activeCommunities.slice(0, 3).map((community: ActiveCommunity) => (
                    <Link
                      key={community.id}
                      href={`/${city}/communities/${community.slug}`}
                      className="hover:bg-muted-bg/60 flex items-center justify-between rounded-lg px-3 py-2 transition-colors"
                    >
                      <span className="text-foreground line-clamp-1 text-sm font-medium">
                        {community.name}
                      </span>
                      <span className="text-muted ml-3 shrink-0 text-xs">
                        {community._count.events > 0
                          ? `${community._count.events} event${community._count.events !== 1 ? 's' : ''}`
                          : `${community.memberCountApprox ? `~${community.memberCountApprox.toLocaleString()}` : 'Active'} members`}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Link
                href={`/${city}/communities`}
                className="rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-black/[0.06] transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <p className="text-sm font-semibold text-sky-700">Join a community</p>
                <p className="text-muted mt-1 text-xs">
                  Find active groups by category and language.
                </p>
              </Link>
              <Link
                href={`/${city}/resources`}
                className="rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-black/[0.06] transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <p className="text-sm font-semibold text-amber-700">Explore resources</p>
                <p className="text-muted mt-1 text-xs">
                  Useful city guides while you wait for new listings.
                </p>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {thisWeek.events.map((event: ThisWeekEvent) => (
                <EventCard key={event.id} event={event} city={city} />
              ))}
            </div>

            {lowUpcomingEvents && (
              <div className="from-brand-50 to-accent-50/30 rounded-[var(--radius-panel)] bg-gradient-to-r p-4 ring-1 ring-black/[0.06]">
                <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-foreground text-sm font-semibold">
                      More ways to stay active
                    </p>
                    <p className="text-muted text-xs">
                      Low event volume this period. Explore communities and city resources.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/${city}/communities`} className="btn-primary px-3 py-1.5 text-xs">
                      Browse communities
                    </Link>
                    <Link
                      href={`/${city}/resources`}
                      className="text-foreground bg-white px-3 py-1.5 text-xs font-semibold ring-1 ring-black/[0.08] transition-colors hover:bg-black/[0.02]"
                    >
                      City resources
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Recently Happened */}
      {recentPastEvents.length > 0 && (
        <section className="space-y-5">
          <SectionHeader
            title="Recently Happened"
            subtitle={`Catch up on what's been active in ${cityName}`}
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {recentPastEvents.map((event: RecentPastEvent) => (
              <EventCard key={event.id} event={event} city={city} past />
            ))}
          </div>
        </section>
      )}

      {/* Browse by Category - colorful grid */}
      {categories.length > 0 && (
        <section className="space-y-5">
          <SectionHeader title="Browse by Category" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {categories.map((cat: CategoryItem, i: number) => (
              <Link
                key={cat.slug}
                href={`/${city}/communities?category=${cat.slug}`}
                className="group relative flex flex-col items-center gap-2.5 overflow-hidden rounded-2xl bg-white p-5 text-center shadow-sm ring-1 ring-black/[0.06] transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
              >
                <span
                  className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${CAT_COLORS[i % CAT_COLORS.length]} text-xl shadow-sm transition-transform duration-200 group-hover:scale-105`}
                >
                  {cat.icon}
                </span>
                <span className="text-foreground group-hover:text-brand-600 text-sm font-medium transition-colors">
                  {cat.name}
                </span>
                <span className="text-muted text-xs">
                  {cat.communityCount} communit{cat.communityCount !== 1 ? 'ies' : 'y'}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Active Communities */}
      <section className="space-y-5">
        <SectionHeader
          title="Active Communities"
          action={{ label: 'See all', href: `/${city}/communities` }}
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {activeCommunities.map((community: ActiveCommunity) => (
            <CommunityCard
              key={community.id}
              community={community}
              city={city}
              savedByUser={savedCommunityIds.has(community.id)}
            />
          ))}
        </div>
        <p className="text-muted text-center text-sm">
          Don&apos;t see a community?{' '}
          <Link
            href={`/${city}/suggest`}
            className="text-brand-600 hover:text-brand-700 font-semibold hover:underline"
          >
            Suggest one →
          </Link>
        </p>
      </section>

      {/* Quick links - brand palette */}
      <section className="grid gap-5 sm:grid-cols-2">
        <Link
          href={`/${city}/business-events`}
          className="group flex items-center gap-4 overflow-hidden rounded-xl bg-gradient-to-r from-emerald-50 to-white p-5 ring-1 ring-emerald-200/50 transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 text-xl shadow-sm">
            💼
          </span>
          <div>
            <p className="text-foreground text-sm font-semibold transition-colors group-hover:text-emerald-700">
              Business and careers
            </p>
            <p className="text-muted mt-0.5 text-xs">
              Networking nights, career talks, startup and founder events
            </p>
          </div>
        </Link>

        <Link
          href={`/${city}/resources`}
          className="from-accent-50 ring-accent-200/50 group flex items-center gap-4 overflow-hidden rounded-xl bg-gradient-to-r to-white p-5 ring-1 transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <span className="from-accent-400 to-accent-600 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-xl shadow-sm">
            🧭
          </span>
          <div>
            <p className="text-foreground group-hover:text-accent-700 text-sm font-semibold transition-colors">
              Expat-life resources
            </p>
            <p className="text-muted mt-0.5 text-xs">
              Anmeldung, Kindergeld, doctors, grocers &amp; more
            </p>
          </div>
        </Link>
        <Link
          href={`/${city}/consular-services`}
          className="from-brand-50 ring-brand-200/50 group flex items-center gap-4 overflow-hidden rounded-xl bg-gradient-to-r to-white p-5 ring-1 transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <span className="from-brand-500 to-brand-700 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-xl shadow-sm">
            🏛️
          </span>
          <div>
            <p className="text-foreground group-hover:text-brand-700 text-sm font-semibold transition-colors">
              Consular services
            </p>
            <p className="text-muted mt-0.5 text-xs">CGI camps, passport, visa &amp; OCI</p>
          </div>
        </Link>
      </section>
    </div>
  );
}
