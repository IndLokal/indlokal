import { requireCan } from '@/lib/auth/permissions';
import { db } from '@/lib/db';
import { AmbassadorSubmitForm } from './SubmitForm';

export const metadata = { title: 'Submit — Ambassador' };

export default async function AmbassadorSubmitPage() {
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
      <h1 className="mb-2 text-2xl font-bold">Quick submit</h1>
      <p className="text-muted mb-8 text-sm">
        Your submission goes straight to the fast-track pipeline queue.
      </p>
      <AmbassadorSubmitForm cities={cities} defaultCityId={defaultCityId} />
    </div>
  );
}
