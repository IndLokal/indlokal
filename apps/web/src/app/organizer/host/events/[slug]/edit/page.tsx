import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/session';
import { OrganizerPageHeader } from '@/components/organizer/page-shell';
import EditHostEventForm from './EditHostEventForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Edit Host Event - Event Host' };

type Props = { params: Promise<{ slug: string }> };

function toLocalInputValue(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function toFallbackEndInputValue(start: Date, end: Date | null): string {
  return toLocalInputValue(end ?? new Date(start.getTime() + 2 * 60 * 60 * 1000));
}

export default async function EditHostEventPage({ params }: Props) {
  const { slug } = await params;
  const user = await getSessionUser();
  if (!user) notFound();

  const event = await db.event.findFirst({
    where: {
      slug,
      createdByUserId: user.id,
    },
    select: {
      slug: true,
      title: true,
      description: true,
      cityId: true,
      city: { select: { id: true, name: true } },
      startsAt: true,
      endsAt: true,
      venueName: true,
      venueAddress: true,
      isOnline: true,
      onlineLink: true,
      registrationUrl: true,
      cost: true,
    },
  });

  if (!event) notFound();

  return (
    <div className="space-y-8">
      <OrganizerPageHeader
        title="Edit Host Event"
        description="Update your event details. Published edits re-enter review before going live."
        backHref="/organizer/host/events"
      />

      <EditHostEventForm
        event={{
          slug: event.slug,
          title: event.title,
          description: event.description,
          cityId: event.cityId,
          startsAt: toLocalInputValue(event.startsAt),
          endsAt: toFallbackEndInputValue(event.startsAt, event.endsAt),
          venueName: event.venueName,
          venueAddress: event.venueAddress,
          isOnline: event.isOnline,
          onlineLink: event.onlineLink,
          registrationUrl: event.registrationUrl,
          cost: event.cost,
        }}
        city={event.city}
      />
    </div>
  );
}
