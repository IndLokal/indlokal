import { db } from '@/lib/db';
import { createResourceAction } from '../../actions';
import { AdminPage, AdminPageHeader } from '@/components/admin/page-shell';
import { ResourceForm } from '@/components/admin/ResourceForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'New resource - Admin' };

export default async function NewResourcePage() {
  const cities = await db.city.findMany({
    where: { isActive: true },
    select: { slug: true, name: true },
    orderBy: { name: 'asc' },
  });

  return (
    <AdminPage>
      <AdminPageHeader
        title="New resource"
        backHref="/admin/data/resources"
        backLabel="Resources"
      />
      <div className="mt-6">
        <ResourceForm action={createResourceAction} cities={cities} submitLabel="Create resource" />
      </div>
    </AdminPage>
  );
}
