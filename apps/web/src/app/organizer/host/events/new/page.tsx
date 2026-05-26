import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import { db } from '@/lib/db';
import { AddHostEventForm } from './AddHostEventForm';

export const metadata = { title: 'Post an Event - Event Host' };

export default async function HostNewEventPage() {
  const user = await getSessionUser();
  if (!user) redirect('/organizer/host/start');

  const cities = await db.city.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  const defaultCityId = user.cityId ?? undefined;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Post an event</h1>
        <p className="text-muted mt-1 text-sm">
          Your event will appear in the IndLokal feed with your name as host. Events are reviewed
          before going live.
        </p>
      </div>

      <div className="card-base p-6">
        <AddHostEventForm cities={cities} defaultCityId={defaultCityId} />
      </div>
    </div>
  );
}
