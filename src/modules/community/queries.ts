import { db } from '@/lib/db';
import type { CommunityWithRelations, CommunityListItem } from './types';

/**
 * Get a single community with all relations for the detail page.
 */
export async function getCommunityBySlug(slug: string): Promise<CommunityWithRelations | null> {
  return db.community.findFirst({
    where: { slug, status: { not: 'INACTIVE' } },
    include: {
      city: true,
      categories: { include: { category: true } },
      accessChannels: { orderBy: { isPrimary: 'desc' } },
      events: {
        where: { startsAt: { gte: new Date() } },
        orderBy: { startsAt: 'asc' },
        take: 10,
      },
    },
  });
}

/**
 * Get communities for a city, ordered by activity score.
 * Includes metro-region satellite cities.
 */
export async function getCommunitiesByCity(
  citySlug: string,
  options?: {
    categorySlug?: string;
    limit?: number;
    offset?: number;
  },
): Promise<CommunityListItem[]> {
  const city = await db.city.findUnique({
    where: { slug: citySlug },
    select: { id: true, isMetroPrimary: true, satelliteCities: { select: { id: true } } },
  });

  if (!city) return [];

  // Include satellite city IDs if this is a metro primary
  const cityIds = [city.id, ...city.satelliteCities.map((s: { id: string }) => s.id)];

  return db.community.findMany({
    where: {
      cityId: { in: cityIds },
      status: { not: 'INACTIVE' },
      ...(options?.categorySlug && {
        categories: { some: { category: { slug: options.categorySlug } } },
      }),
    },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      status: true,
      activityScore: true,
      completenessScore: true,
      trustScore: true,
      isTrending: true,
      memberCountApprox: true,
      logoUrl: true,
      lastActivityAt: true,
      languages: true,
      claimState: true,
      city: { select: { name: true, slug: true } },
      categories: { select: { category: { select: { name: true, slug: true, icon: true } } } },
      _count: { select: { events: { where: { startsAt: { gte: new Date() } } } } },
    },
    orderBy: { activityScore: 'desc' },
    take: options?.limit ?? 20,
    skip: options?.offset ?? 0,
  });
}
