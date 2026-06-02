import { db } from '@/lib/db';
import { approveCityChangeRequest, rejectCityChangeRequest } from '../actions';
import { AdminPage, AdminPageHeader } from '@/components/admin/page-shell';
import { ConfirmSubmitButton } from '@/components/ui';

export const metadata = { title: 'City Change Requests - Admin' };

export default async function AdminCityChangesPage() {
  const cityChangeRequests = await db.community.findMany({
    where: {
      metadata: {
        path: ['cityChangeRequest', 'status'],
        equals: 'PENDING',
      },
    },
    include: {
      city: { select: { name: true, slug: true } },
      claimedBy: { select: { email: true, displayName: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  type CityRow = { id: string; name: string; slug: string };
  const cityRows = (await db.city.findMany({
    select: { id: true, name: true, slug: true },
  })) as CityRow[];
  const cityById = new Map<string, CityRow>();
  for (const city of cityRows) {
    cityById.set(city.id, city);
  }

  type CityChangeRow = (typeof cityChangeRequests)[number];

  return (
    <AdminPage>
      <AdminPageHeader
        title="City Change Requests"
        description={`${cityChangeRequests.length} pending review`}
        backHref="/admin"
      />

      {cityChangeRequests.length === 0 ? (
        <p className="text-muted mt-12 text-center">No pending city-change requests.</p>
      ) : (
        <div className="mt-8 space-y-6">
          {(cityChangeRequests as CityChangeRow[]).map((community) => {
            const meta = community.metadata as Record<string, unknown> | null;
            const request = (meta?.cityChangeRequest ?? null) as {
              requestedAt?: string;
              toCityId?: string;
              reason?: string;
              evidenceUrl?: string;
            } | null;
            if (!request) return null;

            const target = request.toCityId ? cityById.get(request.toCityId) : null;

            return (
              <div key={community.id} className="card-base p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-semibold">{community.name}</h2>
                    <p className="text-muted mt-0.5 text-sm">
                      {community.city.name} ({community.city.slug}) →{' '}
                      {target?.name ?? 'Unknown city'} ({target?.slug ?? '—'})
                    </p>

                    {community.claimedBy && (
                      <p className="text-muted mt-2 text-sm">
                        Requested by: {community.claimedBy.displayName ?? 'Unknown'} (
                        {community.claimedBy.email})
                      </p>
                    )}

                    {request.reason && (
                      <p className="bg-muted-bg text-muted mt-3 rounded-[var(--radius-button)] p-3 text-sm">
                        {request.reason}
                      </p>
                    )}

                    {request.evidenceUrl && (
                      <p className="mt-2 text-sm">
                        <a
                          href={request.evidenceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-600 hover:text-brand-700 underline"
                        >
                          View evidence link ↗
                        </a>
                      </p>
                    )}

                    {request.requestedAt && (
                      <p className="text-muted mt-2 text-xs">
                        Requested:{' '}
                        {new Intl.DateTimeFormat('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          timeZone: 'UTC',
                        }).format(new Date(request.requestedAt))}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <form action={approveCityChangeRequest}>
                      <input type="hidden" name="id" value={community.id} />
                      <ConfirmSubmitButton
                        triggerLabel="Approve"
                        title="Approve city-change request?"
                        description="This will move the community to the requested city and reindex city routes."
                        confirmLabel="Approve city move"
                        tone="primary"
                        triggerClassName="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                      />
                    </form>
                    <form action={rejectCityChangeRequest}>
                      <input type="hidden" name="id" value={community.id} />
                      <ConfirmSubmitButton
                        triggerLabel="Reject"
                        title="Reject city-change request?"
                        description="This keeps the community in its current city."
                        confirmLabel="Reject request"
                        tone="danger"
                        triggerClassName="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                      />
                    </form>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AdminPage>
  );
}
