/**
 * Test fixtures — typed factory functions for domain objects.
 *
 * Each factory accepts a partial override so tests can
 * specify only what they care about:
 *
 *   const city = await createCity(testDb);
 *   const community = await createCommunity(testDb, { cityId: city.id, name: 'HSS Stuttgart' });
 *
 * Fixtures insert directly via the testDb client so they bypass
 * application-layer logic intentionally.
 */
import type { PrismaClient } from '@prisma/client';

// ─── City ────────────────────────────────────────────────────────────────────

export async function createCity(db: PrismaClient, overrides: Record<string, unknown> = {}) {
  return db.city.create({
    data: {
      name: 'Stuttgart',
      slug: 'stuttgart',
      state: 'Baden-Württemberg',
      country: 'Germany',
      isActive: true,
      isMetroPrimary: true,
      timezone: 'Europe/Berlin',
      ...overrides,
    },
  });
}

// ─── Community ───────────────────────────────────────────────────────────────

export async function createCommunity(
  db: PrismaClient,
  overrides: { cityId: string } & Record<string, unknown>,
) {
  const { cityId, ...rest } = overrides;
  return db.community.create({
    data: {
      name: 'HSS Stuttgart',
      slug: 'hss-stuttgart',
      status: 'ACTIVE',
      claimState: 'UNCLAIMED',
      activityScore: 0,
      completenessScore: 0,
      trustScore: 0,
      cityId,
      ...rest,
    },
  });
}

// ─── Event ───────────────────────────────────────────────────────────────────

export async function createEvent(
  db: PrismaClient,
  overrides: { cityId: string } & Record<string, unknown>,
) {
  const { cityId, ...rest } = overrides;
  const now = new Date();
  return db.event.create({
    data: {
      title: 'Holi Celebration Stuttgart 2026',
      slug: 'holi-stuttgart-2026',
      status: 'UPCOMING',
      startsAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), // tomorrow
      cityId,
      ...rest,
    },
  });
}
