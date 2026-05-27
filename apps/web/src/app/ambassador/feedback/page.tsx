import { requireCan } from '@/lib/auth/permissions';
import { db } from '@/lib/db';
import { AdminPage, AdminPageHeader } from '@/components/admin/page-shell';
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
    <AdminPage>
      <div className="max-w-xl">
        <AdminPageHeader
          title="Log Feedback"
          description="Spotted something wrong, missing, or broken? Tell the ops team."
        />
        <FeedbackForm cities={cities} defaultCityId={defaultCityId} />
      </div>
    </AdminPage>
  );
}
