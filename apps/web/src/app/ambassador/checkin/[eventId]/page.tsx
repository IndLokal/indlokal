import { notFound } from 'next/navigation';
import { requireCan } from '@/lib/auth/permissions';
import { db } from '@/lib/db';
import { CheckInForm } from '../CheckInForm';

export const dynamic = 'force-dynamic';

export default async function CheckInPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  await requireCan('ambassador.checkin');

  const event = await db.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      startsAt: true,
      endsAt: true,
      venueName: true,
      venueAddress: true,
      isOnline: true,
      community: { select: { name: true } },
      city: { select: { name: true } },
    },
  });

  if (!event) notFound();

  const startLabel = new Date(event.startsAt).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <div className="mb-8">
        <p className="text-muted text-xs font-medium uppercase tracking-wide">Check-in</p>
        <h1 className="mt-1 text-2xl font-bold">{event.title}</h1>
        <div className="text-muted mt-3 space-y-1 text-sm">
          {event.community && <p>Organised by {event.community.name}</p>}
          <p>{startLabel}</p>
          {event.isOnline ? (
            <p>Online event</p>
          ) : (
            event.venueName && (
              <p>
                {event.venueName}
                {event.venueAddress ? ` · ${event.venueAddress}` : ''}
              </p>
            )
          )}
          <p>City: {event.city.name}</p>
        </div>
      </div>

      <div className="border-border rounded-[var(--radius-card)] border bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold">Confirm your attendance</h2>
        <CheckInForm eventId={eventId} />
      </div>
    </div>
  );
}
