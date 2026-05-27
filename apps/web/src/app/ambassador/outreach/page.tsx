import Link from 'next/link';
import { requireCan } from '@/lib/auth/permissions';
import { db } from '@/lib/db';
import { OutreachKanban } from '@/app/admin/(dashboard)/outreach/OutreachKanban';
import { CreateLeadForm } from '@/app/admin/(dashboard)/outreach/CreateLeadForm';
import { AdminPage, AdminPageHeader } from '@/components/admin/page-shell';

export const metadata = { title: 'Outreach - Ambassador Console' };
export const dynamic = 'force-dynamic';

export default async function AmbassadorOutreachPage() {
  const user = await requireCan('outreach.read');

  // Scope to cities where the user is an active CITY_AMBASSADOR
  const cityScopes = user.roleAssignments
    .filter((a) => a.role === 'CITY_AMBASSADOR' && a.cityId && !a.revokedAt)
    .map((a) => a.cityId as string);

  // Build DB filter: ambassador sees their own city leads; admin sees all
  const where = cityScopes.length > 0 ? { cityId: { in: cityScopes }, ownerUserId: user.id } : {};

  const [leads, cities] = await Promise.all([
    db.outreachLead.findMany({
      where,
      include: {
        city: { select: { name: true } },
        community: { select: { name: true } },
        _count: { select: { notes: true } },
      },
      orderBy: [{ nextActionAt: 'asc' }, { createdAt: 'desc' }],
    }),
    db.city.findMany({
      where: cityScopes.length > 0 ? { id: { in: cityScopes } } : { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const defaultCityId = cityScopes.length === 1 ? cityScopes[0] : undefined;

  return (
    <AdminPage>
      <AdminPageHeader
        title="Outreach Pipeline"
        description="Communities you are cultivating in your city"
        backHref="/ambassador"
        backLabel="Dashboard"
      />

      {leads.length === 0 ? (
        <div className="border-border mb-8 rounded-[var(--radius-card)] border border-dashed py-16 text-center">
          <p className="text-muted text-sm">No leads yet. Add your first lead below.</p>
        </div>
      ) : (
        <OutreachKanban leads={leads} showCityBadge={cityScopes.length !== 1} />
      )}

      {/* Create lead */}
      <details className="mt-10">
        <summary className="border-border hover:bg-muted-bg inline-flex cursor-pointer rounded-[var(--radius-button)] border px-3 py-2 text-sm font-semibold transition-colors">
          + Add lead
        </summary>
        <div className="border-border mt-4 max-w-lg rounded-[var(--radius-card)] border p-6">
          <CreateLeadForm
            cities={cities}
            defaultCityId={defaultCityId}
            operators={[{ id: user.id, displayName: user.displayName, email: user.email }]}
            currentUserId={user.id}
          />
        </div>
      </details>
    </AdminPage>
  );
}
