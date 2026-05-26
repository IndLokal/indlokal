import { requireCan } from '@/lib/auth/permissions';
import { db } from '@/lib/db';
import { FeedbackForm } from './FeedbackForm';

export const metadata = { title: 'Feedback - Ambassador' };

export default async function AmbassadorFeedbackPage() {
  const user = await requireCan('ambassador.submit');

  const cityIds = user.roleAssignments
    .filter((a) => a.role === 'CITY_AMBASSADOR' && a.cityId && !a.revokedAt)
    .map((a) => a.cityId as string);

  const cities = await db.city.findMany({
    where: cityIds.length > 0 ? { id: { in: cityIds }, isActive: true } : { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  const defaultCityId = cityIds.length === 1 ? cityIds[0] : undefined;

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold">Log feedback</h1>
      <p className="text-muted mb-8 text-sm">
        Spotted something wrong, missing, or broken? Tell the ops team.
      </p>
      <FeedbackForm cities={cities} defaultCityId={defaultCityId} />
    </div>
  );
}
