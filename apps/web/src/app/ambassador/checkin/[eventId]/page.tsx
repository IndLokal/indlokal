import { notFound } from 'next/navigation';
import { requireCan } from '@/lib/auth/permissions';
import { db } from '@/lib/db';
import { AdminPage, AdminPageHeader } from '@/components/admin/page-shell';
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
    <AdminPage>
      <div className="max-w-xl">
        <AdminPageHeader
          title={event.title}
          description={
            <span className="space-y-1">
              {event.community && (
                <span className="block">Organised by {event.community.name}</span>
              )}
              <span className="block">{startLabel}</span>
              {event.isOnline ? (
                <span className="block">Online event</span>
              ) : (
                event.venueName && (
                  <span className="block">
                    {event.venueName}
                    {event.venueAddress ? ` · ${event.venueAddress}` : ''}
                  </span>
                )
              )}
              <span className="block">City: {event.city.name}</span>
            </span>
          }
          backHref="/ambassador"
          backLabel="Dashboard"
        />

        <div className="border-border rounded-[var(--radius-card)] border bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold">Confirm your attendance</h2>
          <CheckInForm eventId={eventId} />
        </div>
      </div>
    </AdminPage>
  );
}
