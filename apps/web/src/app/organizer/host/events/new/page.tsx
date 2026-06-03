import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import { db } from '@/lib/db';
import { AddHostEventForm } from './AddHostEventForm';
import { OrganizerPageHeader } from '@/components/organizer/page-shell';

export const metadata = { title: 'Post an Event - Event Host' };

export default async function HostNewEventPage() {
  const user = await getSessionUser();
  if (!user) redirect('/organizer/host/start');

  const cities = await db.city.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  const categories = await db.category.findMany({
    where: { type: 'CATEGORY' },
    select: { slug: true, name: true, icon: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });

  const defaultCityId = user.cityId ?? undefined;

  return (
    <div className="max-w-2xl space-y-6">
      <OrganizerPageHeader
        title="Post an event"
        description="Your event appears in the IndLokal feed with your name as host. Events are reviewed before going live."
      />

      <div className="card-base p-6">
        <AddHostEventForm cities={cities} categories={categories} defaultCityId={defaultCityId} />
      </div>
    </div>
  );
}
