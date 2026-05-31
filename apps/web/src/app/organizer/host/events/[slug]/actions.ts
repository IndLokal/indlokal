'use server';

import { revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/session';
import { withAction } from '@/lib/api/handlers';

export async function archiveHostEvent(formData: FormData): Promise<void> {
  const user = await getSessionUser();
  if (!user || user.role !== 'EVENT_HOST') {
    return;
  }

  const slug = formData.get('slug') as string;
  const event = await db.event.findFirst({
    where: { slug, createdByUserId: user.id },
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
      redirect('/organizer/host/events');
    },
    () => undefined,
  );
}
