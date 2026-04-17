import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { getSessionUser } from '@/lib/session';
import { db } from '@/lib/db';
import { PreferencesForm } from './PreferencesForm';

export const metadata: Metadata = {
  title: 'My Profile — LocalPulse',
  robots: { index: false },
};

export default async function MePage() {
  const user = await getSessionUser();
  if (!user) redirect('/me/login');

  const [savedCommunities, savedEvents, activeCities] = await Promise.all([
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
      where: { userId: user.id },
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

  return (
    <div className="mx-auto max-w-3xl space-y-10 px-4 py-10">
      {/* Profile header */}
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
        </div>
      </div>

      {/* Preferences */}
      <section>
        <h2 className="text-xl font-semibold">Preferences</h2>
        <p className="text-muted mt-1 text-sm">
          Personalise LocalPulse to show content relevant to you.
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

      {/* Saved Communities */}
      <section>
        <h2 className="text-xl font-semibold">Saved Communities</h2>
        {savedCommunities.length === 0 ? (
          <p className="text-muted mt-3 text-sm">
            No saved communities yet.{' '}
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

      {/* Quick links */}
      <section className="flex flex-wrap gap-3 text-sm">
        <Link href="/" className="btn-secondary px-4 py-2 text-sm">
          Explore cities
        </Link>
        <Link href="/organizer/login" className="btn-secondary px-4 py-2 text-sm">
          Organizer dashboard →
        </Link>
      </section>

      {/* Saved Events */}
      <section>
        <h2 className="text-xl font-semibold">Saved Events</h2>
        {savedEvents.length === 0 ? (
          <p className="text-muted mt-3 text-sm">No saved events yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {savedEvents.map(({ event }) => (
              <Link
                key={event.id}
                href={`/${event.city.slug}/events/${event.slug}`}
                className="card-base flex items-center justify-between p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div>
                  <p className="text-foreground font-medium">{event.title}</p>
                  <p className="text-muted mt-0.5 text-sm">
                    {format(new Date(event.startsAt), 'EEE, MMM d · h:mm a')}
                    {event.isOnline ? ' · Online' : event.venueName ? ` · ${event.venueName}` : ''}
                  </p>
                  <p className="text-muted mt-0.5 text-xs">{event.city.name}</p>
                </div>
                <span className="text-muted shrink-0">→</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
