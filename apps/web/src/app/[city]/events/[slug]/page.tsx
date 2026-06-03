import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { format } from 'date-fns';
import { SATELLITE_TO_METRO } from '@/lib/config';
import EventDetailServer from '@/components/EventDetailServer';
import { getEventBySlug, isEventSaved } from '@/modules/event';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/session';

type Props = {
  params: Promise<{ city: string; slug: string }>;
  searchParams?: Promise<{ lens?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) return { title: 'Event not found' };
  const dateStr = format(new Date(event.startsAt), 'MMM d, yyyy');
  return {
    title: `${event.title} - ${dateStr}`,
    description: event.description ?? `${event.title} in ${event.city.name}, Germany.`,
  };
}

export default async function EventDetailPage({ params, searchParams }: Props) {
  const { city, slug } = await params;
  const sp = searchParams ? await searchParams : {};
  const lensContext: 'business_careers' | undefined =
    sp.lens === 'business' ? 'business_careers' : undefined;

  const event = await getEventBySlug(slug);
  if (!event) notFound();

  const canonicalCity = SATELLITE_TO_METRO[event.city.slug] ?? event.city.slug;
  if (canonicalCity !== city) {
    redirect(`/${canonicalCity}/events/${slug}${lensContext ? '?lens=business' : ''}`);
  }

  const user = await getSessionUser();
  const savedByUser = user ? await isEventSaved(user.id, event.id) : false;

  // Host attribution for host-posted events (no community)
  const hostUserId =
    !event.communityId && (event.metadata as Record<string, unknown> | null)?.hostUserId;
  let hostDisplayName: string | null = null;
  if (hostUserId && typeof hostUserId === 'string') {
    const hostUser = await db.user.findUnique({
      where: { id: hostUserId },
      select: { displayName: true, email: true, metadata: true },
    });
    if (hostUser) {
      const hostProfile = (hostUser.metadata as Record<string, unknown> | null)?.hostProfile as
        | { displayName?: string }
        | undefined;
      hostDisplayName = hostProfile?.displayName ?? hostUser.displayName ?? hostUser.email;
    }
  }

  return (
    <>
      <EventDetailServer
        event={event}
        city={canonicalCity}
        savedByUser={savedByUser}
        hostDisplayName={hostDisplayName}
        lensContext={lensContext}
      />
    </>
  );
}
