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
