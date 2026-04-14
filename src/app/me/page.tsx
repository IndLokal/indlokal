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
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 text-xl font-bold text-indigo-700">
            {initial}
          </div>
        )}
        <div>
          <p className="font-semibold text-gray-900">{user.displayName ?? user.email}</p>
          <p className="text-sm text-gray-500">{user.email}</p>
        </div>
      </div>

      {/* Preferences */}
      <section>
        <h2 className="text-xl font-semibold">Preferences</h2>
        <p className="mt-1 text-sm text-gray-500">
          Personalise LocalPulse to show content relevant to you.
        </p>
        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
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
          <p className="mt-3 text-sm text-gray-400">
            No saved communities yet.{' '}
            <Link href="/" className="text-indigo-600 hover:underline">
              Browse cities →
            </Link>
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {savedCommunities.map(({ community }) => (
              <Link
                key={community.id}
                href={`/${community.city.slug}/communities/${community.slug}`}
                className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-base font-bold text-indigo-700">
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
                  <p className="font-medium text-gray-900">{community.name}</p>
                  {community.description && (
                    <p className="mt-0.5 truncate text-sm text-gray-500">{community.description}</p>
                  )}
                  <p className="mt-0.5 text-xs text-gray-400">{community.city.name}</p>
                </div>
                <span className="shrink-0 text-gray-400">→</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Saved Events */}
      <section>
        <h2 className="text-xl font-semibold">Saved Events</h2>
        {savedEvents.length === 0 ? (
          <p className="mt-3 text-sm text-gray-400">No saved events yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {savedEvents.map(({ event }) => (
              <Link
                key={event.id}
                href={`/${event.city.slug}/events/${event.slug}`}
                className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <div>
                  <p className="font-medium text-gray-900">{event.title}</p>
                  <p className="mt-0.5 text-sm text-gray-500">
                    {format(new Date(event.startsAt), 'EEE, MMM d · h:mm a')}
                    {event.isOnline ? ' · Online' : event.venueName ? ` · ${event.venueName}` : ''}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400">{event.city.name}</p>
                </div>
                <span className="shrink-0 text-gray-400">→</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
