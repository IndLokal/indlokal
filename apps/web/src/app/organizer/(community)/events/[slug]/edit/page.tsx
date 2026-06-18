import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireOrganizerWorkspace } from '@/lib/organizer/workspace';
import { canEditCommunity } from '@/lib/auth/community-permissions';
import { OrganizerPageHeader } from '@/components/organizer/page-shell';
import EditEventForm from './EditEventForm';
import {
  formatDateTimeLocalInTimeZone,
  DEFAULT_EVENT_TIMEZONE,
} from '@/lib/datetime/event-timezone';
import { recurrenceRuleToPreset } from '@/lib/events/recurrence';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Edit Event - Organizer' };

type Props = { params: Promise<{ slug: string }> };

export default async function EditCommunityEventPage({ params }: Props) {
  const { slug } = await params;
  const { user, community } = await requireOrganizerWorkspace();

  if (!community || !canEditCommunity(user, community.id)) {
    notFound();
  }

  const categories = await db.category.findMany({
    where: { type: 'CATEGORY' },
    select: { slug: true, name: true, icon: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });

  const event = await db.event.findFirst({
    where: { slug, communityId: community.id },
    select: {
      slug: true,
      title: true,
      description: true,
      startsAt: true,
      endsAt: true,
      isRecurring: true,
      recurrenceRule: true,
      venueName: true,
      venueAddress: true,
      isOnline: true,
      onlineLink: true,
      imageUrl: true,
      registrationUrl: true,
      cost: true,
      accessType: true,
      city: { select: { timezone: true } },
      categories: { select: { category: { select: { slug: true } } } },
    },
  });

  if (!event) notFound();

  const timeZone = event.city.timezone || DEFAULT_EVENT_TIMEZONE;
  const startsAt = formatDateTimeLocalInTimeZone(event.startsAt, timeZone);
  const fallbackEnd = event.endsAt ?? new Date(event.startsAt.getTime() + 2 * 60 * 60 * 1000);
  const endsAt = formatDateTimeLocalInTimeZone(fallbackEnd, timeZone);

  return (
    <div className="space-y-8">
      <OrganizerPageHeader
        title="Edit Event"
        description={`Update the details for ${event.title}. Community edits stay published.`}
        backHref="/organizer/events"
      />

      <EditEventForm
        communityName={community.name}
        timeZone={timeZone}
        categories={categories}
        event={{
          slug: event.slug,
          title: event.title,
          description: event.description,
          categorySlugs: event.categories.map((item) => item.category.slug),
          startsAt,
          endsAt,
          recurrencePreset: recurrenceRuleToPreset(event.recurrenceRule),
          venueName: event.venueName,
          venueAddress: event.venueAddress,
          isOnline: event.isOnline,
          onlineLink: event.onlineLink,
          imageUrl: event.imageUrl,
          registrationUrl: event.registrationUrl,
          cost: event.cost,
        }}
      />
    </div>
  );
}
