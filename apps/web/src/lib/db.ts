import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}

/**
 * Resolve a city slug to an array of city IDs (primary + satellites).
 * Used across modules for metro-area scoped queries.
 */
export async function resolveCityIds(citySlug: string): Promise<string[]> {
  const city = await db.city.findUnique({
    where: { slug: citySlug },
    select: { id: true, satelliteCities: { select: { id: true } } },
  });
  if (!city) return [];
  return [city.id, ...city.satelliteCities.map((s: { id: string }) => s.id)];
}

/**
 * Resolve city scope parameters used by resource resolution and search.
 * Returns `null` when the city slug is unknown.
 */
export async function resolveCityScopeParams(citySlug: string): Promise<{
  cityIds: string[];
  slug: string;
  state: string;
  metroSlug?: string | null;
  satelliteSlugs: string[];
} | null> {
  const city = await db.city.findUnique({
    where: { slug: citySlug },
    select: {
      id: true,
      slug: true,
      state: true,
      metroRegion: { select: { slug: true } },
      satelliteCities: { select: { id: true, slug: true } },
    },
  });
  if (!city) return null;
  const cityIds = [city.id, ...city.satelliteCities.map((s: { id: string }) => s.id)];
  return {
    cityIds,
    slug: city.slug,
    state: city.state,
    metroSlug: city.metroRegion?.slug ?? null,
    satelliteSlugs: city.satelliteCities.map((s: { slug: string }) => s.slug),
  };
}
