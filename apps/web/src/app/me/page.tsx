import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSessionUser } from '@/lib/session';
import { SATELLITE_TO_METRO } from '@/lib/config';
import { db } from '@/lib/db';
import { signOut } from '@/app/actions/auth';
import { can, type SessionUser } from '@/lib/auth/permissions';
import { PreferencesForm } from './PreferencesForm';
import { formatEventCardDate, DEFAULT_EVENT_TIMEZONE } from '@/lib/datetime/event-timezone';
import { LocalDeviceSavesCard } from './LocalDeviceSavesCard';

export const metadata: Metadata = {
  title: 'My Account - IndLokal',
  robots: { index: false },
};

const RESOURCE_CATEGORY_BY_TYPE = {
  CONSULAR_SERVICE: 'consular-services',
  OFFICIAL_EVENT: 'consular-services',
  GOVERNMENT_INFO: 'consular-services',
  VISA_SERVICE: 'city-registration',
  CITY_REGISTRATION: 'city-registration',
  DRIVING: 'driving-transport',
  HOUSING: 'housing-utilities',
  HEALTH_DOCTORS: 'health-insurance',
  FAMILY_CHILDREN: 'family-childcare',
  JOBS_CAREERS: 'jobs-careers',
  TAX_FINANCE: 'tax-finance',
  BUSINESS_SETUP: 'business-entrepreneurship',
  GROCERY_FOOD: 'grocery-food',
  COMMUNITY_RESOURCE: 'community-living',
} as const;

type ResourceTypeKey = keyof typeof RESOURCE_CATEGORY_BY_TYPE;

export default async function MePage() {
  const user = await getSessionUser();
  if (!user) redirect('/me/login');

  const [savedCommunities, savedEvents, savedResources, activeCities] = await Promise.all([
    db.savedCommunity.findMany({
      where: { userId: user.id },
      orderBy: { savedAt: 'desc' },
      include: {
        community: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            logoUrl: true,
            city: { select: { name: true, slug: true } },
          },
        },
      },
    }),
    db.savedEvent.findMany({
      where: { userId: user.id, event: { moderationState: 'PUBLISHED' } },
      orderBy: { savedAt: 'desc' },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            slug: true,
            startsAt: true,
            venueName: true,
            isOnline: true,
            city: { select: { name: true, slug: true, timezone: true } },
          },
        },
      },
    }),
    db.savedResource.findMany({
      where: { userId: user.id },
      orderBy: { savedAt: 'desc' },
      include: {
        resource: {
          select: {
            id: true,
            title: true,
            slug: true,
            resourceType: true,
            city: { select: { name: true, slug: true } },
          },
        },
      },
    }),
    db.city.findMany({
      where: { isActive: true },
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const initial = user.displayName?.charAt(0) ?? user.email.charAt(0).toUpperCase();
  const fallbackCitySlug =
    activeCities.find((city) => city.id === user.cityId)?.slug ??
    activeCities[0]?.slug ??
    'stuttgart';
  const isAdminLike = user.role === 'PLATFORM_ADMIN' || user.role === 'OPS_LEAD';
  const permissionUser = user as SessionUser;
  const hasOrganizerAccess =
    can(permissionUser, 'organizer.edit') ||
    can(permissionUser, 'organizer.events.write') ||
    user.claimedCommunities.length > 0;
  const hasAmbassadorAccess =
    isAdminLike ||
    user.roleAssignments.some(
      (a: { role: string; revokedAt: Date | null }) => a.role === 'CITY_AMBASSADOR' && !a.revokedAt,
    );
  const hasHostAccess = user.role === 'EVENT_HOST' || user.role === 'PLATFORM_ADMIN';
  const roleBadges: string[] = [];
  if (hasOrganizerAccess) roleBadges.push('Organizer');
  if (hasHostAccess) roleBadges.push('Event Host');
  if (hasAmbassadorAccess) roleBadges.push('Ambassador');
  if (isAdminLike) roleBadges.push('Admin');

  type SavedCommunityItem = {
    community: {
      id: string;
      name: string;
      slug: string;
      description: string | null;
      logoUrl: string | null;
      city: { name: string; slug: string };
    };
  };

  type SavedEventItem = {
    event: {
      id: string;
      title: string;
      slug: string;
      startsAt: Date;
      venueName: string | null;
      isOnline: boolean;
      city: { name: string; slug: string; timezone: string };
    };
  };

  const now = new Date();
  const savedEventItems = savedEvents as SavedEventItem[];
  const upcomingSavedEvents = savedEventItems
    .filter(({ event }) => new Date(event.startsAt) >= now)
    .sort((a, b) => new Date(a.event.startsAt).getTime() - new Date(b.event.startsAt).getTime());
  const pastSavedEvents = savedEventItems
    .filter(({ event }) => new Date(event.startsAt) < now)
    .sort((a, b) => new Date(b.event.startsAt).getTime() - new Date(a.event.startsAt).getTime());

  return (
    <div className="mx-auto max-w-3xl space-y-10 px-4 py-10">
      {/* Profile header */}
      <div className="card-base flex items-start justify-between gap-4 p-4">
        <div className="flex items-center gap-4">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt={user.displayName ?? 'Avatar'}
              className="h-14 w-14 rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="bg-brand-100 text-brand-700 flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold">
              {initial}
            </div>
          )}
          <div>
            <p className="text-foreground font-semibold">{user.displayName ?? user.email}</p>
            <p className="text-muted text-sm">{user.email}</p>
            {roleBadges.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {roleBadges.map((badge) => (
                  <span
                    key={badge}
                    className="bg-muted-bg text-muted rounded-[var(--radius-badge)] border px-2 py-0.5 text-[11px] font-medium"
                  >
                    {badge}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="border-border text-muted hover:text-foreground hover:bg-muted-bg rounded-[var(--radius-button)] border px-3 py-1.5 text-sm transition-colors"
          >
            Sign out
          </button>
        </form>
      </div>

      {/* Workspaces */}
      <section>
        <h2 className="text-xl font-semibold">Workspaces</h2>
        <p className="text-muted mt-1 text-sm">
          Personal settings and internal consoles are both available from here.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="card-base p-4">
            <p className="text-muted text-[11px] font-semibold tracking-[0.08em] uppercase">
              Personal
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <Link href="/" className="btn-secondary px-4 py-2 text-sm">
                Explore cities
              </Link>
            </div>
          </div>

          <div className="card-base p-4">
            <p className="text-muted text-[11px] font-semibold tracking-[0.08em] uppercase">
              Internal
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              {hasOrganizerAccess && (
                <Link href="/organizer" className="btn-secondary px-4 py-2 text-sm">
                  Organizer Home →
                </Link>
              )}
              {hasHostAccess && (
                <Link href="/organizer/host" className="btn-secondary px-4 py-2 text-sm">
                  Event Host Home →
                </Link>
              )}
              {hasAmbassadorAccess && (
                <Link href="/ambassador" className="btn-secondary px-4 py-2 text-sm">
                  Ambassador Console →
                </Link>
              )}
              {isAdminLike && (
                <Link href="/admin" className="btn-secondary px-4 py-2 text-sm">
                  IndLokal Admin →
                </Link>
              )}
              {!hasOrganizerAccess && !hasHostAccess && !hasAmbassadorAccess && !isAdminLike && (
                <p className="text-muted text-sm">
                  No internal workspace is enabled for this account.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Preferences */}
      <section>
        <h2 className="text-xl font-semibold">Preferences</h2>
        <p className="text-muted mt-1 text-sm">
          Personalise IndLokal to show content relevant to you.
        </p>
        <div className="card-base mt-4 p-5">
          <PreferencesForm
            cities={activeCities}
            currentCityId={user.cityId ?? null}
            currentPersonas={user.personaSegments ?? []}
            currentLanguages={user.preferredLanguages ?? []}
          />
        </div>
      </section>

      <LocalDeviceSavesCard fallbackCitySlug={fallbackCitySlug} />

      {/* Following */}
      <section>
        <h2 className="text-xl font-semibold">Following</h2>
        {savedCommunities.length === 0 ? (
          <p className="text-muted mt-3 text-sm">
            You are not following any communities yet.{' '}
            <Link
              href="/"
              className="text-brand-600 hover:text-brand-700 font-medium hover:underline"
            >
              Browse cities →
            </Link>
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {savedCommunities.map(({ community }: SavedCommunityItem) => (
              <Link
                key={community.id}
                href={`/${community.city.slug}/communities/${community.slug}`}
                className="card-base flex items-center gap-4 p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="bg-brand-100 text-brand-700 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-bold">
                  {community.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={community.logoUrl}
                      alt={community.name}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    community.name.charAt(0)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-foreground font-medium">{community.name}</p>
                  {community.description && (
                    <p className="text-muted mt-0.5 truncate text-sm">{community.description}</p>
                  )}
                  <p className="text-muted mt-0.5 text-xs">{community.city.name}</p>
                </div>
                <span className="text-muted shrink-0">→</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Saved Events */}
      <section>
        <h2 className="text-xl font-semibold">Saved Events</h2>
        {savedEvents.length === 0 ? (
          <p className="text-muted mt-3 text-sm">
            No saved events yet.{' '}
            <Link
              href="/"
              className="text-brand-600 hover:text-brand-700 font-medium hover:underline"
            >
              Discover upcoming events →
            </Link>
          </p>
        ) : (
          <div className="mt-4 space-y-6">
            {upcomingSavedEvents.length > 0 && (
              <div>
                <h3 className="text-muted mb-2 text-xs font-semibold tracking-[0.08em] uppercase">
                  Upcoming
                </h3>
                <div className="space-y-3">
                  {upcomingSavedEvents.map(({ event }) => (
                    <Link
                      key={event.id}
                      href={`/${SATELLITE_TO_METRO[event.city.slug] ?? event.city.slug}/events/${event.slug}`}
                      className="card-base flex items-center justify-between p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <div>
                        <p className="text-foreground font-medium">{event.title}</p>
                        <p className="text-muted mt-0.5 text-sm">
                          {formatEventCardDate(
                            new Date(event.startsAt),
                            event.city.timezone ?? DEFAULT_EVENT_TIMEZONE,
                          )}
                          {event.isOnline
                            ? ' · Online'
                            : event.venueName
                              ? ` · ${event.venueName}`
                              : ''}
                        </p>
                        <p className="text-muted mt-0.5 text-xs">{event.city.name}</p>
                      </div>
                      <span className="text-muted shrink-0">→</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {pastSavedEvents.length > 0 && (
              <div>
                <h3 className="text-muted mb-2 text-xs font-semibold tracking-[0.08em] uppercase">
                  Past
                </h3>
                <div className="space-y-3">
                  {pastSavedEvents.map(({ event }) => (
                    <Link
                      key={event.id}
                      href={`/${SATELLITE_TO_METRO[event.city.slug] ?? event.city.slug}/events/${event.slug}`}
                      className="card-base flex items-center justify-between p-4 opacity-80 transition-all hover:-translate-y-0.5 hover:opacity-100 hover:shadow-md"
                    >
                      <div>
                        <p className="text-foreground font-medium">{event.title}</p>
                        <p className="text-muted mt-0.5 text-sm">
                          {formatEventCardDate(
                            new Date(event.startsAt),
                            event.city.timezone ?? DEFAULT_EVENT_TIMEZONE,
                          )}
                          {event.isOnline
                            ? ' · Online'
                            : event.venueName
                              ? ` · ${event.venueName}`
                              : ''}
                        </p>
                        <p className="text-muted mt-0.5 text-xs">{event.city.name}</p>
                      </div>
                      <span className="text-muted shrink-0">→</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Saved Resources */}
      <section>
        <h2 className="text-xl font-semibold">Saved Resources</h2>
        {savedResources.length === 0 ? (
          <p className="text-muted mt-3 text-sm">
            No saved resources yet.{' '}
            <Link
              href={`/${fallbackCitySlug}/resources`}
              className="text-brand-600 hover:text-brand-700 font-medium hover:underline"
            >
              Browse resources →
            </Link>
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {savedResources.map(({ resource }) => {
              const citySlug = resource.city?.slug ?? fallbackCitySlug;
              const categorySlug =
                RESOURCE_CATEGORY_BY_TYPE[resource.resourceType as ResourceTypeKey] ??
                'city-registration';

              return (
                <Link
                  key={resource.id}
                  href={`/${citySlug}/resources/${categorySlug}#${resource.slug}`}
                  className="card-base flex items-center justify-between p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="min-w-0">
                    <p className="text-foreground truncate font-medium">{resource.title}</p>
                    <p className="text-muted mt-0.5 text-xs">
                      {resource.city?.name ?? 'Germany'} ·{' '}
                      {resource.resourceType.replaceAll('_', ' ')}
                    </p>
                  </div>
                  <span className="text-muted shrink-0">→</span>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
