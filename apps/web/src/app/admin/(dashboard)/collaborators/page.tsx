import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { buildOffsetPaginationMeta, buildPageHref, parseOffsetPagination } from '@/lib/pagination';
import { AdminPage, AdminPageHeader } from '@/components/admin/page-shell';
import { AdminFilterActions, AdminFilterBar, AdminFilterItem } from '@/components/admin/filter-bar';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { approveCollaboratorRequest, rejectCollaboratorRequest } from '../actions';

export const metadata = { title: 'Collaborator Requests - Admin' };

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
  const source = ['ALL', 'PUBLIC_REQUEST', 'COMMUNITY_ADMIN_INVITE'].includes(sp.source ?? '')
    ? (sp.source as 'ALL' | 'PUBLIC_REQUEST' | 'COMMUNITY_ADMIN_INVITE')
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

  const communityPagination = parseOffsetPagination(sp, {
    pageParam: 'communityPage',
    pageSizeParam: 'communityPageSize',
    defaultPageSize: 20,
  });
  const requestPagination = parseOffsetPagination(sp, {
    pageParam: 'requestPage',
    pageSizeParam: 'requestPageSize',
    defaultPageSize: 20,
  });

  const [communityTotalCount, requestTotalCount, cities] = await Promise.all([
    db.community.count({ where: communityWhere }),
    db.communityCollaborator.count({ where: requestWhere }),
    db.city.findMany({
      where: { isActive: true },
      select: { slug: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const communityPage = Math.min(
    communityPagination.page,
    Math.max(1, Math.ceil(communityTotalCount / communityPagination.pageSize)),
  );
  const requestPage = Math.min(
    requestPagination.page,
    Math.max(1, Math.ceil(requestTotalCount / requestPagination.pageSize)),
  );

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
      skip: (communityPage - 1) * communityPagination.pageSize,
      take: communityPagination.pageSize,
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
      skip: (requestPage - 1) * requestPagination.pageSize,
      take: requestPagination.pageSize,
    }),
  ]);

  const communityPaginationMeta = buildOffsetPaginationMeta({
    page: communityPage,
    pageSize: communityPagination.pageSize,
    totalCount: communityTotalCount,
    itemCount: communityAccess.length,
  });
  const requestPaginationMeta = buildOffsetPaginationMeta({
    page: requestPage,
    pageSize: requestPagination.pageSize,
    totalCount: requestTotalCount,
    itemCount: requests.length,
  });

  return (
    <AdminPage>
      <AdminPageHeader
        title="Organizer and Collaborator Access"
        description={`${requestTotalCount} pending review · ${communityTotalCount} communities with organizer access data`}
        backHref="/admin"
      />

      <form method="GET" className="mt-8">
        <input type="hidden" name="communityPage" value="1" />
        <input type="hidden" name="requestPage" value="1" />
        <input
          type="hidden"
          name="communityPageSize"
          value={String(communityPagination.pageSize)}
        />
        <input type="hidden" name="requestPageSize" value={String(requestPagination.pageSize)} />
        <AdminFilterBar className="border-border">
          <AdminFilterItem label="Search">
            <input
              name="q"
              defaultValue={query}
              placeholder="Community, slug, organizer email"
              className="border-border w-full rounded border px-3 py-2 text-sm"
            />
          </AdminFilterItem>
          <AdminFilterItem label="City">
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
          </AdminFilterItem>
          <AdminFilterItem label="Access scope">
            <select
              name="access"
              defaultValue={access}
              className="border-border w-full rounded border px-3 py-2 text-sm"
            >
              <option value="ALL">All access records</option>
              <option value="CLAIMED">Claimed communities only</option>
              <option value="COLLABORATORS">Communities with collaborators</option>
            </select>
          </AdminFilterItem>
          <AdminFilterItem label="Request source">
            <select
              name="source"
              defaultValue={source}
              className="border-border w-full rounded border px-3 py-2 text-sm"
            >
              <option value="ALL">All pending requests</option>
              <option value="PUBLIC_REQUEST">Public request</option>
              <option value="COMMUNITY_ADMIN_INVITE">Organizer invite</option>
            </select>
          </AdminFilterItem>
          <AdminFilterActions resetHref="/admin/collaborators" />
        </AdminFilterBar>
      </form>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Community Access Map</h2>

        {communityTotalCount === 0 ? (
          <p className="text-muted mt-2">No organizer or collaborator records found yet.</p>
        ) : (
          <div className="space-y-4">
            <p className="text-muted text-sm">
              Showing{' '}
              {Math.min(
                (communityPage - 1) * communityPagination.pageSize + 1,
                communityTotalCount,
              )}
              -{Math.min(communityPage * communityPagination.pageSize, communityTotalCount)} of{' '}
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

            <PaginationControls
              className="pt-2"
              meta={communityPaginationMeta}
              getPageHref={(page) =>
                buildPageHref({
                  searchParams: sp,
                  pageParam: 'communityPage',
                  page,
                })
              }
            />
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
              Showing{' '}
              {Math.min((requestPage - 1) * requestPagination.pageSize + 1, requestTotalCount)}-
              {Math.min(requestPage * requestPagination.pageSize, requestTotalCount)} of{' '}
              {requestTotalCount} pending requests.
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

            <PaginationControls
              className="pt-2"
              meta={requestPaginationMeta}
              getPageHref={(page) =>
                buildPageHref({
                  searchParams: sp,
                  pageParam: 'requestPage',
                  page,
                })
              }
            />
          </div>
        )}
      </section>
    </AdminPage>
  );
}
