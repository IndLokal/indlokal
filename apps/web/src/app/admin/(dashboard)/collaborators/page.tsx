import { db } from '@/lib/db';
import { AdminPage, AdminPageHeader } from '@/components/admin/page-shell';
import { approveCollaboratorRequest, rejectCollaboratorRequest } from '../actions';

export const metadata = { title: 'Collaborator Requests - Admin' };

export default async function AdminCollaboratorRequestsPage() {
  const requests = await db.communityCollaborator.findMany({
    where: { status: 'PENDING' },
    include: {
      community: {
        select: {
          name: true,
          slug: true,
          city: { select: { name: true, slug: true } },
        },
      },
      user: { select: { email: true, displayName: true } },
      requestedByUser: { select: { email: true, displayName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <AdminPage>
      <AdminPageHeader
        title="Collaborator Access Requests"
        description={`${requests.length} pending review`}
        backHref="/admin"
      />

      {requests.length === 0 ? (
        <p className="text-muted mt-10 text-center">No collaborator requests to review.</p>
      ) : (
        <div className="mt-8 space-y-4">
          {requests.map((request) => {
            const metadata = (request.metadata ?? {}) as {
              relationship?: string;
              message?: string;
              requestedAt?: string;
            };

            return (
              <div key={request.id} className="card-base p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-semibold">
                      {request.community.name}
                      <span className="text-muted ml-2 text-sm font-normal">
                        ({request.community.city.name})
                      </span>
                    </h2>

                    <p className="text-muted mt-1 text-sm">
                      Requester: {request.user.displayName ?? 'Unknown'} ({request.user.email})
                    </p>

                    {metadata.relationship ? (
                      <p className="text-muted mt-1 text-sm">
                        Relationship: {metadata.relationship}
                      </p>
                    ) : null}

                    {metadata.message ? (
                      <p className="text-muted mt-1 text-sm">Message: {metadata.message}</p>
                    ) : null}

                    <p className="text-muted mt-1 text-xs">
                      Source: {request.source} · Requested:{' '}
                      {new Date(metadata.requestedAt ?? request.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <form action={approveCollaboratorRequest}>
                      <input type="hidden" name="id" value={request.id} />
                      <button
                        type="submit"
                        className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                      >
                        Approve
                      </button>
                    </form>
                    <form action={rejectCollaboratorRequest}>
                      <input type="hidden" name="id" value={request.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                      >
                        Reject
                      </button>
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
