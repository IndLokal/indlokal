'use server';

import { revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getCurrentCommunityId, getSessionUser } from '@/lib/session';
import { withAction } from '@/lib/api/handlers';
import { canEditCommunity } from '@/lib/auth/community-permissions';
import {
  resolveActiveOrganizerCommunity,
  type OrganizerSessionCommunity,
} from '@/lib/organizer/workspace';

export async function archiveEvent(eventSlug: string, formData: FormData): Promise<void> {
  const user = await getSessionUser();
  if (!user || user.claimedCommunities.length === 0) {
    return;
  }

  const currentId = await getCurrentCommunityId();
  const community = resolveActiveOrganizerCommunity<OrganizerSessionCommunity>(
    user.claimedCommunities,
    currentId,
  );

  if (!community) {
    return;
  }

  if (!canEditCommunity(user, community.id)) {
    return;
  }

  const event = await db.event.findFirst({
    where: { slug: eventSlug, communityId: community.id },
    select: { id: true, cityId: true },
  });

  if (!event) {
    return;
  }

  await withAction(
    async () => {
      await db.event.update({
        where: { id: event.id },
        data: { status: 'CANCELLED' },
      });

      revalidateTag('city-feed', 'max');
      revalidateTag(`city-events-${event.cityId}`, 'max');
      redirect('/organizer/events');
    },
    () => undefined,
  );
}
