import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}

/**
 * Resolve a city slug to an array of city IDs in metro scope.
 *
 * Scope rules:
 * - Metro primary selection => metro primary + all satellites
 * - Satellite selection => satellite + metro primary + sibling satellites
 * - Standalone city => just that city
 *
 * Used across modules for metro-area scoped queries.
 */
export async function resolveCityIds(citySlug: string): Promise<string[]> {
  return resolveMetroScopeCityIds(citySlug);
}

/**
 * Resolve a city slug to its metro scope city IDs.
 *
 * Scope rules:
 * - Metro primary selection => metro primary + all satellites
 * - Satellite selection => satellite + metro primary + sibling satellites
 * - Standalone city => just that city
 */
export async function resolveMetroScopeCityIds(citySlug: string): Promise<string[]> {
  const city = await db.city.findUnique({
    where: { slug: citySlug },
    select: {
      id: true,
      metroRegion: {
        select: {
          id: true,
          satelliteCities: { select: { id: true } },
        },
      },
      satelliteCities: { select: { id: true } },
    },
  });

  if (!city) return [];

  const cityIds = new Set<string>([city.id]);
  if (city.metroRegion) {
    cityIds.add(city.metroRegion.id);
    for (const satellite of city.metroRegion.satelliteCities) {
      cityIds.add(satellite.id);
    }
  } else {
    for (const satellite of city.satelliteCities) {
      cityIds.add(satellite.id);
    }
  }

  return [...cityIds];
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
