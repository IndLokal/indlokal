/**
 * Integration tests - resource reverification queue (B2).
 *
 * @db - requires test database.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanDb, testDb } from '@/test/db-helpers';
import { createCity, createResource, createUser } from '@/test/fixtures';

vi.mock('@/lib/db', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/db')>();
  const { testDb } = await import('@/test/db-helpers');
  async function resolveCityIds(citySlug: string): Promise<string[]> {
    const city = await testDb.city.findUnique({ where: { slug: citySlug }, select: { id: true } });
    return city ? [city.id] : [];
  }
  return { ...mod, db: testDb, resolveCityIds };
});

import {
  assignReverificationItem,
  ingestReverificationQueue,
  resolveReverificationItem,
  setReverificationSla,
} from '..';

beforeEach(async () => {
  await cleanDb();
});

afterAll(async () => {
  await testDb.$disconnect();
});

describe('@db resource reverification queue', () => {
  it('creates queue rows deterministically for stale resources only', async () => {
    const city = await createCity(testDb, { slug: 'stuttgart' });

    await createResource(testDb, {
      cityId: city.id,
      scope: 'CITY',
      scopeRegion: city.slug,
      slug: 'stale-resource',
      lastReviewedAt: new Date('2023-01-01T00:00:00.000Z'),
      reviewCadenceDays: 30,
      isEssential: true,
    });

    await createResource(testDb, {
      cityId: city.id,
      scope: 'CITY',
      scopeRegion: city.slug,
      slug: 'fresh-resource',
      lastReviewedAt: new Date('2099-01-01T00:00:00.000Z'),
      reviewCadenceDays: 30,
    });

    const result = await ingestReverificationQueue(new Date('2026-06-10T00:00:00.000Z'));

    expect(result.scanned).toBe(2);
    expect(result.upserted).toBe(1);

    const rows = await testDb.resourceReverificationQueue.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('OPEN');
    expect(rows[0].priorityScore).toBeGreaterThan(0);
  });

  it('upserts by resourceId without creating duplicates', async () => {
    const city = await createCity(testDb, { slug: 'stuttgart' });
    const resource = await createResource(testDb, {
      cityId: city.id,
      scope: 'CITY',
      scopeRegion: city.slug,
      slug: 'idempotent-stale-resource',
      lastReviewedAt: new Date('2023-01-01T00:00:00.000Z'),
      reviewCadenceDays: 30,
    });

    await ingestReverificationQueue(new Date('2026-06-10T00:00:00.000Z'));
    await ingestReverificationQueue(new Date('2026-06-11T00:00:00.000Z'));

    const rows = await testDb.resourceReverificationQueue.findMany({
      where: { resourceId: resource.id },
    });
    expect(rows).toHaveLength(1);
  });

  it('supports assignment, SLA update, and hidden resolution flow', async () => {
    const city = await createCity(testDb, { slug: 'stuttgart' });
    const reviewer = await createUser(testDb, {
      email: 'ops-reviewer@example.com',
      role: 'PLATFORM_ADMIN',
    });
    const owner = await createUser(testDb, {
      email: 'ops-owner@example.com',
      role: 'OPS_LEAD',
    });

    const resource = await createResource(testDb, {
      cityId: city.id,
      scope: 'CITY',
      scopeRegion: city.slug,
      slug: 'resolvable-stale-resource',
      lastReviewedAt: new Date('2023-01-01T00:00:00.000Z'),
      reviewCadenceDays: 30,
    });

    await ingestReverificationQueue(new Date('2026-06-10T00:00:00.000Z'));
    const queue = await testDb.resourceReverificationQueue.findUnique({
      where: { resourceId: resource.id },
    });
    expect(queue).not.toBeNull();

    await assignReverificationItem({
      id: queue!.id,
      ownerUserId: owner.id,
      reviewerId: reviewer.id,
    });

    await setReverificationSla({
      id: queue!.id,
      slaDueAt: new Date('2026-06-15T00:00:00.000Z'),
      reviewerId: reviewer.id,
    });

    await resolveReverificationItem({
      id: queue!.id,
      action: 'HIDDEN',
      notes: 'Source no longer valid',
      reviewerId: reviewer.id,
    });

    const updatedQueue = await testDb.resourceReverificationQueue.findUnique({
      where: { id: queue!.id },
    });
    expect(updatedQueue?.status).toBe('RESOLVED');
    expect(updatedQueue?.resolutionAction).toBe('HIDDEN');

    const updatedResource = await testDb.resource.findUnique({ where: { id: resource.id } });
    expect(updatedResource?.isHidden).toBe(true);

    const logs = await testDb.contentLog.findMany({
      where: { entityType: 'resource', entityId: resource.id },
    });
    expect(logs.length).toBeGreaterThanOrEqual(3);
  });
});
