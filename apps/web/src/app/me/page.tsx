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
  DRIVING: 'driving',
  HOUSING: 'housing',
  HEALTH_DOCTORS: 'health-doctors',
  FAMILY_CHILDREN: 'family-children',
  JOBS_CAREERS: 'jobs-careers',
  TAX_FINANCE: 'tax-finance',
  BUSINESS_SETUP: 'business-setup',
  GROCERY_FOOD: 'grocery-food',
  COMMUNITY_RESOURCE: 'community-resource',
} as const;

type ResourceTypeKey = keyof typeof RESOURCE_CATEGORY_BY_TYPE;

function resolveEventTimezone(value: string | null | undefined): string {
  if (!value) return DEFAULT_EVENT_TIMEZONE;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
    return value;
  } catch {
    return DEFAULT_EVENT_TIMEZONE;
  }
}

export default async function MePage() {
  const user = await getSessionUser();
  if (!user) redirect('/me/login');

  const onboardingNeedsAttention = !user.onboardingComplete;

  const loadAccountLists = () =>
    Promise.all([
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

  type AccountLists = Awaited<ReturnType<typeof loadAccountLists>>;
  let accountLists: AccountLists;

  try {
    accountLists = await loadAccountLists();
  } catch (err) {
    console.error('[MePage] Failed to load account lists; rendering with empty fallbacks.', err);
    accountLists = [[], [], [], []] as AccountLists;
  }

  const [savedCommunities, savedEvents, savedResources, activeCities] = accountLists;

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
  const hasInternalAccess =
    hasOrganizerAccess || hasHostAccess || hasAmbassadorAccess || isAdminLike;

  let toolsLabel = 'Team tools';
  if (isAdminLike) {
    toolsLabel = 'Admin tools';
  } else if (hasOrganizerAccess && !hasHostAccess && !hasAmbassadorAccess) {
    toolsLabel = 'Organizer tools';
  } else if (hasHostAccess && !hasOrganizerAccess && !hasAmbassadorAccess) {
    toolsLabel = 'Host tools';
  } else if (hasAmbassadorAccess && !hasOrganizerAccess && !hasHostAccess) {
    toolsLabel = 'Ambassador tools';
  }

  const roleBadges: string[] = [];
  if (hasOrganizerAccess) roleBadges.push('Organizer');
  if (hasHostAccess) roleBadges.push('Event Host');
  if (hasAmbassadorAccess) roleBadges.push('Ambassador');
  if (isAdminLike) roleBadges.push('Admin');

  const now = new Date();
  const upcomingSavedEvents = savedEvents
    .filter(({ event }) => new Date(event.startsAt) >= now)
    .sort((a, b) => new Date(a.event.startsAt).getTime() - new Date(b.event.startsAt).getTime());
  const pastSavedEvents = savedEvents
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

      {onboardingNeedsAttention && (
        <section className="card-base border-brand-300 bg-brand-50 p-5">
          <p className="text-brand-800 text-xs font-semibold tracking-[0.08em] uppercase">
            Finish setup
          </p>
          <h2 className="text-foreground mt-2 text-xl font-semibold">Complete your profile</h2>
          <p className="text-muted mt-1 text-sm">
            Add your city, personas, and languages to personalize your feed and recommendations.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a href="#preferences" className="btn-primary px-4 py-2 text-sm">
              Complete profile now
            </a>
          </div>
        </section>
      )}

      {/* Quick links */}
      <section>
        <h2 className="text-xl font-semibold">Quick links</h2>
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

          {hasInternalAccess && (
            <div className="card-base p-4">
              <p className="text-muted text-[11px] font-semibold tracking-[0.08em] uppercase">
                {toolsLabel}
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
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Preferences */}
      <section id="preferences">
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
            {savedCommunities.map(({ community }) => (
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
                            resolveEventTimezone(event.city.timezone),
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
                            resolveEventTimezone(event.city.timezone),
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

      <LocalDeviceSavesCard fallbackCitySlug={fallbackCitySlug} />

      <section className="border-border/70 space-y-4 border-t pt-8">
        <div>
          <h2 className="text-xl font-semibold">Account and Privacy</h2>
          <p className="text-muted mt-1 text-sm">
            Manage your data rights and legal information in one place.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="card-base p-4">
            <p className="text-muted text-[11px] font-semibold tracking-[0.08em] uppercase">
              Data rights
            </p>
            <p className="text-muted mt-2 text-sm">
              Export your account data or permanently delete your account.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <Link href="/me/export" className="btn-secondary px-4 py-2 text-sm">
                Export my data (JSON)
              </Link>
              <Link
                href="/me/delete-account"
                className="rounded-[var(--radius-button)] border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
              >
                Delete account
              </Link>
            </div>
          </div>

          <div className="card-base p-4">
            <p className="text-muted text-[11px] font-semibold tracking-[0.08em] uppercase">
              Legal
            </p>
            <p className="text-muted mt-2 text-sm">
              Review how your data is processed and the governing terms.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <Link href="/privacy" className="btn-secondary px-4 py-2 text-sm">
                Privacy Policy
              </Link>
              <Link href="/terms" className="btn-secondary px-4 py-2 text-sm">
                Terms of Service
              </Link>
              <Link href="/impressum" className="btn-secondary px-4 py-2 text-sm">
                Impressum
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
