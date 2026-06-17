import { db } from '@/lib/db';

export interface SavedResourceRow {
  resourceId: string;
  savedAt: Date;
  resource: {
    id: string;
    title: string;
    slug: string;
    resourceType: string;
    city: { name: string; slug: string } | null;
  };
}

export async function getSavedResources(
  userId: string,
  opts: { cursor?: string; limit: number },
): Promise<{ items: SavedResourceRow[]; hasMore: boolean }> {
  const rows = await db.savedResource.findMany({
    where: { userId },
    take: opts.limit + 1,
    ...(opts.cursor
      ? {
          skip: 1,
          cursor: { userId_resourceId: { userId, resourceId: opts.cursor } },
        }
      : {}),
    orderBy: { savedAt: 'desc' },
    select: {
      resourceId: true,
      savedAt: true,
      resource: {
        select: {
          id: true,
          title: true,
          slug: true,
          resourceType: true,
          city: { select: { name: true, slug: true } },
        },
      },
    },
  });

  const hasMore = rows.length > opts.limit;
  const items = hasMore ? rows.slice(0, opts.limit) : rows;
  return { items, hasMore };
}
