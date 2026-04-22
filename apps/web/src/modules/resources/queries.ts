import { db } from '@/lib/db';
import type { ResourceType } from '@prisma/client';

export interface ResourceRow {
  id: string;
  title: string;
  slug: string;
  resourceType: ResourceType;
  url: string | null;
  description: string | null;
  validFrom: Date | null;
  validUntil: Date | null;
  metadata: unknown;
  createdAt: Date;
}

/**
 * Get resources for a city, optionally filtered by resource type.
 * Returns an empty array if the city doesn't exist.
 */
export async function getResourcesByCity(
  citySlug: string,
  type?: ResourceType,
): Promise<ResourceRow[]> {
  const city = await db.city.findUnique({ where: { slug: citySlug }, select: { id: true } });
  if (!city) return [];

  return db.resource.findMany({
    where: {
      cityId: city.id,
      ...(type && { resourceType: type }),
    },
    select: {
      id: true,
      title: true,
      slug: true,
      resourceType: true,
      url: true,
      description: true,
      validFrom: true,
      validUntil: true,
      metadata: true,
      createdAt: true,
    },
    orderBy: { title: 'asc' },
  });
}
