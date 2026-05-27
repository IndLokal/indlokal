import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { AdminPage, AdminPageHeader } from '@/components/admin/page-shell';
import { approveCollaboratorRequest, rejectCollaboratorRequest } from '../actions';

export const metadata = { title: 'Collaborator Requests - Admin' };

function parsePage(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return 1;
  return parsed;
}

function buildQueryString(params: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) searchParams.set(key, String(value));
  }
  return `?${searchParams.toString()}`;
}

type Props = {
  searchParams: Promise<{
    communityPage?: string;
    requestPage?: string;
    city?: string;
    q?: string;
    access?: string;
    source?: string;
  }>;
};

export default async function AdminCollaboratorRequestsPage({ searchParams }: Props) {
  const sp = await searchParams;

  const citySlug = (sp.city ?? '').trim();
  const query = (sp.q ?? '').trim();
  const access = ['ALL', 'CLAIMED', 'COLLABORATORS'].includes(sp.access ?? '')
    ? (sp.access as 'ALL' | 'CLAIMED' | 'COLLABORATORS')
    : 'ALL';
  const source = ['ALL', 'PUBLIC_REQUEST', 'OWNER_INVITE'].includes(sp.source ?? '')
    ? (sp.source as 'ALL' | 'PUBLIC_REQUEST' | 'OWNER_INVITE')
    : 'ALL';

  const communityWhere: Prisma.CommunityWhereInput = {
    OR:
      access === 'CLAIMED'
        ? [{ claimState: 'CLAIMED' }]
        : access === 'COLLABORATORS'
          ? [{ collaborators: { some: {} } }]
          : [{ claimState: 'CLAIMED' }, { collaborators: { some: {} } }],
  };

  if (citySlug) {
    communityWhere.city = { slug: citySlug };
  }

  if (query) {
    communityWhere.AND = [
      {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { slug: { contains: query, mode: 'insensitive' } },
          { claimedBy: { email: { contains: query, mode: 'insensitive' } } },
          { claimedBy: { displayName: { contains: query, mode: 'insensitive' } } },
          {
            collaborators: {
              some: {
                user: {
                  OR: [
                    { email: { contains: query, mode: 'insensitive' } },
                    { displayName: { contains: query, mode: 'insensitive' } },
                  ],
                },
              },
            },
          },
        ],
      },
    ];
  }

  const requestWhere: Prisma.CommunityCollaboratorWhereInput = {
    status: 'PENDING',
  };

  if (citySlug) {
    requestWhere.community = { city: { slug: citySlug } };
  }
  if (source !== 'ALL') {
    requestWhere.source = source;
  }
  if (query) {
    requestWhere.OR = [
      { community: { name: { contains: query, mode: 'insensitive' } } },
      { community: { slug: { contains: query, mode: 'insensitive' } } },
      { user: { email: { contains: query, mode: 'insensitive' } } },
      { user: { displayName: { contains: query, mode: 'insensitive' } } },
      { requestedByUser: { email: { contains: query, mode: 'insensitive' } } },
      { requestedByUser: { displayName: { contains: query, mode: 'insensitive' } } },
      { requestedEmail: { contains: query, mode: 'insensitive' } },
    ];
  }

  const communityPageSize = 20;
  const requestPageSize = 20;

  const requestedCommunityPage = parsePage(sp.communityPage);
  const requestedRequestPage = parsePage(sp.requestPage);

  const [communityTotalCount, requestTotalCount, cities] = await Promise.all([
    db.community.count({ where: communityWhere }),
    db.communityCollaborator.count({ where: requestWhere }),
    db.city.findMany({
      where: { isActive: true },
      select: { slug: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const communityTotalPages = Math.max(1, Math.ceil(communityTotalCount / communityPageSize));
  const requestTotalPages = Math.max(1, Math.ceil(requestTotalCount / requestPageSize));
  const communityPage = Math.min(requestedCommunityPage, communityTotalPages);
  const requestPage = Math.min(requestedRequestPage, requestTotalPages);

  const [communityAccess, requests] = await Promise.all([
    db.community.findMany({
      where: communityWhere,
      select: {
        id: true,
        name: true,
        slug: true,
        city: { select: { name: true, slug: true } },
        claimedBy: { select: { email: true, displayName: true } },
        collaborators: {
          where: { status: { in: ['ACTIVE', 'PENDING'] } },
          select: {
            id: true,
            status: true,
            source: true,
            createdAt: true,
            user: { select: { email: true, displayName: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { name: 'asc' },
      skip: (communityPage - 1) * communityPageSize,
      take: communityPageSize,
    }),
    db.communityCollaborator.findMany({
      where: requestWhere,
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
      skip: (requestPage - 1) * requestPageSize,
      take: requestPageSize,
    }),
  ]);

  return (
    <AdminPage>
      <AdminPageHeader
        title="Organizer and Collaborator Access"
        description={`${requestTotalCount} pending review · ${communityTotalCount} communities with organizer access data`}
        backHref="/admin"
      />

      <section className="mt-8 rounded-[var(--radius-card)] border p-4">
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" method="GET">
          <div>
            <label className="text-muted mb-1 block text-xs font-medium">Search</label>
            <input
              name="q"
              defaultValue={query}
              placeholder="Community, slug, organizer email"
              className="border-border w-full rounded border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-muted mb-1 block text-xs font-medium">City</label>
            <select
              name="city"
              defaultValue={citySlug}
              className="border-border w-full rounded border px-3 py-2 text-sm"
            >
              <option value="">All cities</option>
              {cities.map((city) => (
                <option key={city.slug} value={city.slug}>
                  {city.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-muted mb-1 block text-xs font-medium">Access scope</label>
            <select
              name="access"
              defaultValue={access}
              className="border-border w-full rounded border px-3 py-2 text-sm"
            >
              <option value="ALL">All access records</option>
              <option value="CLAIMED">Claimed communities only</option>
              <option value="COLLABORATORS">Communities with collaborators</option>
            </select>
          </div>
          <div>
            <label className="text-muted mb-1 block text-xs font-medium">Request source</label>
            <select
              name="source"
              defaultValue={source}
              className="border-border w-full rounded border px-3 py-2 text-sm"
            >
              <option value="ALL">All pending requests</option>
              <option value="PUBLIC_REQUEST">Public request</option>
              <option value="OWNER_INVITE">Owner invite</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button type="submit" className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white">
              Apply
            </button>
            <Link href="/admin/collaborators" className="rounded-md border px-3 py-2 text-sm">
              Reset
            </Link>
          </div>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Community Access Map</h2>

        {communityTotalCount === 0 ? (
          <p className="text-muted mt-2">No organizer or collaborator records found yet.</p>
        ) : (
          <div className="space-y-4">
            <p className="text-muted text-sm">
              Showing {Math.min((communityPage - 1) * communityPageSize + 1, communityTotalCount)}-
              {Math.min(communityPage * communityPageSize, communityTotalCount)} of{' '}
              {communityTotalCount} communities.
            </p>

            {communityAccess.map((community) => {
              const activeCollaborators = community.collaborators.filter(
                (c) => c.status === 'ACTIVE',
              );
              const pendingCollaborators = community.collaborators.filter(
                (c) => c.status === 'PENDING',
              );

              return (
                <div key={community.id} className="card-base p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold">
                        {community.name}
                        <span className="text-muted ml-2 text-sm font-normal">
                          ({community.city.name})
                        </span>
                      </h3>
                      <p className="text-muted mt-1 text-sm">
                        /{community.city.slug}/communities/{community.slug}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="rounded-full bg-green-50 px-2 py-1 text-green-700">
                        Active: {activeCollaborators.length}
                      </span>
                      <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">
                        Pending: {pendingCollaborators.length}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-lg border border-slate-200 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Organizer (Owner)
                      </p>
                      {community.claimedBy ? (
                        <p className="mt-2 text-sm">
                          {community.claimedBy.displayName ?? 'Unknown'} (
                          {community.claimedBy.email})
                        </p>
                      ) : (
                        <p className="text-muted mt-2 text-sm">No claimed organizer</p>
                      )}
                    </div>

                    <div className="rounded-lg border border-slate-200 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Collaborators
                      </p>
                      {community.collaborators.length === 0 ? (
                        <p className="text-muted mt-2 text-sm">No collaborators</p>
                      ) : (
                        <div className="mt-2 space-y-2">
                          {community.collaborators.map((collaborator) => (
                            <p key={collaborator.id} className="text-sm">
                              {collaborator.user.displayName ?? 'Unknown'} (
                              {collaborator.user.email})
                              <span
                                className={`ml-2 rounded-full px-2 py-0.5 text-xs ${collaborator.status === 'ACTIVE' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}
                              >
                                {collaborator.status}
                              </span>
                              <span className="text-muted ml-2 text-xs">{collaborator.source}</span>
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {communityTotalPages > 1 ? (
              <div className="flex items-center justify-end gap-2 pt-2">
                <Link
                  href={buildQueryString({
                    communityPage: Math.max(1, communityPage - 1),
                    requestPage,
                    city: citySlug || undefined,
                    q: query || undefined,
                    access,
                    source,
                  })}
                  className={`rounded-md border px-3 py-1.5 text-sm ${communityPage <= 1 ? 'pointer-events-none opacity-50' : 'hover:bg-muted-bg'}`}
                >
                  Previous
                </Link>
                <span className="text-muted text-sm">
                  Page {communityPage} of {communityTotalPages}
                </span>
                <Link
                  href={buildQueryString({
                    communityPage: Math.min(communityTotalPages, communityPage + 1),
                    requestPage,
                    city: citySlug || undefined,
                    q: query || undefined,
                    access,
                    source,
                  })}
                  className={`rounded-md border px-3 py-1.5 text-sm ${communityPage >= communityTotalPages ? 'pointer-events-none opacity-50' : 'hover:bg-muted-bg'}`}
                >
                  Next
                </Link>
              </div>
            ) : null}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Pending Collaborator Requests</h2>

        {requestTotalCount === 0 ? (
          <p className="text-muted mt-6 text-center">No collaborator requests to review.</p>
        ) : (
          <div className="mt-6 space-y-4">
            <p className="text-muted text-sm">
              Showing {Math.min((requestPage - 1) * requestPageSize + 1, requestTotalCount)}-
              {Math.min(requestPage * requestPageSize, requestTotalCount)} of {requestTotalCount}{' '}
              pending requests.
            </p>

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
                      <h3 className="text-base font-semibold">
                        {request.community.name}
                        <span className="text-muted ml-2 text-sm font-normal">
                          ({request.community.city.name})
                        </span>
                      </h3>

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

            {requestTotalPages > 1 ? (
              <div className="flex items-center justify-end gap-2 pt-2">
                <Link
                  href={buildQueryString({
                    communityPage,
                    requestPage: Math.max(1, requestPage - 1),
                    city: citySlug || undefined,
                    q: query || undefined,
                    access,
                    source,
                  })}
                  className={`rounded-md border px-3 py-1.5 text-sm ${requestPage <= 1 ? 'pointer-events-none opacity-50' : 'hover:bg-muted-bg'}`}
                >
                  Previous
                </Link>
                <span className="text-muted text-sm">
                  Page {requestPage} of {requestTotalPages}
                </span>
                <Link
                  href={buildQueryString({
                    communityPage,
                    requestPage: Math.min(requestTotalPages, requestPage + 1),
                    city: citySlug || undefined,
                    q: query || undefined,
                    access,
                    source,
                  })}
                  className={`rounded-md border px-3 py-1.5 text-sm ${requestPage >= requestTotalPages ? 'pointer-events-none opacity-50' : 'hover:bg-muted-bg'}`}
                >
                  Next
                </Link>
              </div>
            ) : null}
          </div>
        )}
      </section>
    </AdminPage>
  );
}
