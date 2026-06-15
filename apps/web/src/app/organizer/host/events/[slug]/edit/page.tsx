import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/session';
import { OrganizerPageHeader } from '@/components/organizer/page-shell';
import EditHostEventForm from './EditHostEventForm';
import {
  formatDateTimeLocalInTimeZone,
  DEFAULT_EVENT_TIMEZONE,
} from '@/lib/datetime/event-timezone';
import { recurrenceRuleToPreset } from '@/lib/events/recurrence';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Edit Host Event - Event Host' };

type Props = { params: Promise<{ slug: string }> };

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
      city: { select: { id: true, name: true, timezone: true } },
      startsAt: true,
      endsAt: true,
      isRecurring: true,
      recurrenceRule: true,
      venueName: true,
      venueAddress: true,
      isOnline: true,
      onlineLink: true,
      registrationUrl: true,
      cost: true,
      categories: { select: { category: { select: { slug: true } } } },
    },
  });

  if (!event) notFound();

  const categories = await db.category.findMany({
    where: { type: 'CATEGORY' },
    select: { slug: true, name: true, icon: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });

  const timeZone = event.city.timezone || DEFAULT_EVENT_TIMEZONE;
  const startsAt = formatDateTimeLocalInTimeZone(event.startsAt, timeZone);
  const fallbackEnd = event.endsAt ?? new Date(event.startsAt.getTime() + 2 * 60 * 60 * 1000);
  const endsAt = formatDateTimeLocalInTimeZone(fallbackEnd, timeZone);

  return (
    <div className="space-y-8">
      <OrganizerPageHeader
        title="Edit Host Event"
        description="Update your event details. Published edits re-enter review before going live."
        backHref="/organizer/host/events"
      />

      <EditHostEventForm
        categories={categories}
        event={{
          slug: event.slug,
          title: event.title,
          description: event.description,
          cityId: event.cityId,
          categorySlugs: event.categories.map((item) => item.category.slug),
          startsAt,
          endsAt,
          recurrencePreset: recurrenceRuleToPreset(event.recurrenceRule),
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
