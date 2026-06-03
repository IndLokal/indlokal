import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/session';
import { canEditCommunity } from '@/lib/auth/community-permissions';
import { SATELLITE_TO_METRO } from '@/lib/config';
import { verifyPreviewToken } from '@/lib/preview-tokens';
import EventDetailServer from '@/components/EventDetailServer';
import type { EventWithRelations } from '@/modules/event/types';

type Props = { params: Promise<{ slug: string }>; searchParams?: { token?: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const event = await db.event.findFirst({ where: { slug } });
  if (!event) return { title: 'Preview not found' };
  return { title: `${event.title} (Preview)` };
}

export default async function EventPreviewPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = searchParams ?? {};

  // If a token is provided, consume it (one-time). If consumed successfully
  // we will load the event by id. Otherwise, fall back to editor-based access.
  let event: Awaited<ReturnType<typeof db.event.findUnique>> | null = null;
  if (sp?.token) {
    const eventId = verifyPreviewToken(sp.token);
    if (eventId) {
      event = await db.event.findUnique({
        where: { id: eventId },
        include: {
          community: { select: { id: true, name: true, slug: true } },
          city: true,
          categories: { include: { category: true } },
        },
      });
    }
  }

  if (!event) {
    // No valid token; require organizer/editor access
    const maybeEvent = await db.event.findFirst({
      where: { slug },
      select: { id: true, communityId: true, createdByUserId: true },
    });
    if (!maybeEvent) notFound();
    const user = await getSessionUser();
    const isAuthorizedEditor = user
      ? maybeEvent.communityId
        ? canEditCommunity(user, maybeEvent.communityId)
        : maybeEvent.createdByUserId === user.id
      : false;
    if (!isAuthorizedEditor) notFound();
    // Load full event for editor preview (do not consume any token)
    event = await db.event.findFirst({
      where: { slug },
      include: {
        community: { select: { id: true, name: true, slug: true } },
        city: true,
        categories: { include: { category: true } },
      },
    });
  }

  if (!event) notFound();

  const eventRow = event as EventWithRelations;
  const canonicalCity = eventRow.city?.slug
    ? (SATELLITE_TO_METRO[eventRow.city.slug] ?? eventRow.city.slug)
    : 'stuttgart';

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-8">
      <EventDetailServer event={eventRow} city={canonicalCity} />
    </div>
  );
}
