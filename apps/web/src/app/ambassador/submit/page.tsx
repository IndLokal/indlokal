import { requireCan } from '@/lib/auth/permissions';
import { getAmbassadorCityIds } from '@/lib/auth/ambassador';
import { db } from '@/lib/db';
import { AdminPage, AdminPageHeader } from '@/components/admin/page-shell';
import { AmbassadorSubmitForm } from './SubmitForm';

export const metadata = { title: 'Submit - Ambassador' };

export default async function AmbassadorSubmitPage() {
  const user = await requireCan('ambassador.submit');

  const cityIds = getAmbassadorCityIds(user);

  const [cities, categories] = await Promise.all([
    db.city.findMany({
      where: cityIds.length > 0 ? { id: { in: cityIds }, isActive: true } : { isActive: true },
      select: { id: true, name: true, timezone: true },
      orderBy: { name: 'asc' },
    }),
    db.category.findMany({
      where: { type: 'CATEGORY' },
      select: { slug: true, name: true, icon: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
  ]);

  const defaultCityId = cityIds.length === 1 ? cityIds[0] : undefined;

  return (
    <AdminPage>
      <div className="max-w-3xl">
        <AdminPageHeader
          title="Quick Submit"
          description="Your submission goes straight to the fast-track pipeline queue."
        />
        <AmbassadorSubmitForm
          cities={cities}
          categories={categories}
          defaultCityId={defaultCityId}
        />
      </div>
    </AdminPage>
  );
}
