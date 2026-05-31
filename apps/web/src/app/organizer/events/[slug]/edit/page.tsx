import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireOrganizerWorkspace } from '@/lib/organizer/workspace';
import { canEditCommunity } from '@/lib/auth/community-permissions';
import { OrganizerPageHeader } from '@/components/organizer/page-shell';
import EditEventForm from './EditEventForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Edit Event - Organizer' };

type Props = { params: Promise<{ slug: string }> };

function toLocalInputValue(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function toFallbackEndInputValue(start: Date, end: Date | null): string {
  return toLocalInputValue(end ?? new Date(start.getTime() + 2 * 60 * 60 * 1000));
}

export default async function EditCommunityEventPage({ params }: Props) {
  const { slug } = await params;
  const { user, community } = await requireOrganizerWorkspace();

  if (!community || !canEditCommunity(user, community.id)) {
    notFound();
  }

  const event = await db.event.findFirst({
    where: { slug, communityId: community.id },
    select: {
      slug: true,
      title: true,
      description: true,
      startsAt: true,
      endsAt: true,
      venueName: true,
      venueAddress: true,
      isOnline: true,
      onlineLink: true,
      imageUrl: true,
      registrationUrl: true,
      cost: true,
    },
  });

  if (!event) notFound();

  return (
    <div className="space-y-8">
      <OrganizerPageHeader
        title="Edit Event"
        description={`Update the details for ${event.title}. Community edits stay published.`}
        backHref="/organizer/events"
      />

      <EditEventForm
        communityName={community.name}
        event={{
          slug: event.slug,
          title: event.title,
          description: event.description,
          startsAt: toLocalInputValue(event.startsAt),
          endsAt: toFallbackEndInputValue(event.startsAt, event.endsAt),
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
