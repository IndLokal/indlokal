import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { updateResourceAction } from '../../actions';
import { AdminPage, AdminPageHeader } from '@/components/admin/page-shell';
import { ResourceForm } from '@/components/admin/ResourceForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Edit resource - Admin' };

export default async function EditResourcePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [resource, cities] = await Promise.all([
    db.resource.findUnique({
      where: { id },
      include: { city: { select: { slug: true } } },
    }),
    db.city.findMany({
      where: { isActive: true },
      select: { slug: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);
  if (!resource) notFound();

  return (
    <AdminPage>
      <AdminPageHeader
        title={`Edit resource - ${resource.title}`}
        backHref="/admin/data/resources"
        backLabel="Resources"
      />
      <div className="mt-6">
        <ResourceForm
          action={updateResourceAction}
          cities={cities}
          submitLabel="Save resource"
          values={{
            id: resource.id,
            title: resource.title,
            slug: resource.slug,
            resourceType: resource.resourceType,
            scope: resource.scope,
            citySlug: resource.city?.slug ?? '',
            scopeRegion: resource.scopeRegion,
            url: resource.url,
            description: resource.description,
            priority: resource.priority,
            isEssential: resource.isEssential,
            reviewCadenceDays: resource.reviewCadenceDays,
            validFrom: resource.validFrom,
            validUntil: resource.validUntil,
            audiences: resource.audiences,
            lifecycleStage: resource.lifecycleStage,
          }}
        />
      </div>
    </AdminPage>
  );
}
