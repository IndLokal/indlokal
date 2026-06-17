import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanDb, testDb } from '@/test/db-helpers';
import { createCity, createResource } from '@/test/fixtures';

vi.mock('@/lib/db', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/db')>();
  const { testDb: tDb } = await import('@/test/db-helpers');

  async function resolveCityIds(citySlug: string): Promise<string[]> {
    const city = await tDb.city.findUnique({
      where: { slug: citySlug },
      select: { id: true, satelliteCities: { select: { id: true } } },
    });
    if (!city) return [];
    return [city.id, ...city.satelliteCities.map((s: { id: string }) => s.id)];
  }

  return { ...mod, db: tDb, resolveCityIds };
});

const { ingestJourneyGapBacklog } = await import('../ops-backlog');
const { invalidateResolver } = await import('@/modules/resources/resolver');

let cityId: string;

beforeEach(async () => {
  await cleanDb();
  invalidateResolver();
  const city = await createCity(testDb, { slug: 'stuttgart', name: 'Stuttgart', isActive: true });
  cityId = city.id;
});

afterAll(async () => {
  await testDb.$disconnect();
});

describe('journey gap backlog ingestion', () => {
  it('creates backlog rows for THIN persona-stage gaps', async () => {
    await createResource(testDb, {
      title: 'Family visa basics',
      slug: 'family-visa-basics',
      scope: 'CITY',
      cityId,
      audiences: ['FAMILY'],
      lifecycleStage: ['PRE_ARRIVAL'],
      source: 'USER_SUGGESTED',
    });

    const result = await ingestJourneyGapBacklog(new Date('2026-06-10T10:00:00.000Z'));
    expect(result.created).toBeGreaterThan(0);

    const rows = await testDb.journeyGapBacklog.findMany({
      where: { cityId, personaSlug: 'young-family' },
      orderBy: { priorityScore: 'desc' },
    });

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((row) => row.stage === 'FIRST_30_DAYS')).toBe(true);
    expect(rows[0].priorityScore).toBeGreaterThan(0);
    expect(rows[0].slaDueAt).not.toBeNull();
  });

  it('auto-closes open rows that are no longer gaps', async () => {
    await createResource(testDb, {
      title: 'Family pre-arrival 1',
      slug: 'family-pre-1',
      scope: 'CITY',
      cityId,
      audiences: ['FAMILY'],
      lifecycleStage: ['PRE_ARRIVAL'],
    });

    await ingestJourneyGapBacklog(new Date('2026-06-10T10:00:00.000Z'));

    await testDb.resource.createMany({
      data: [
        {
          title: 'Family first 30 1',
          slug: 'family-f30-1',
          cityId,
          scope: 'CITY',
          resourceType: 'CITY_REGISTRATION',
          audiences: ['FAMILY'],
          lifecycleStage: ['FIRST_30_DAYS'],
        },
        {
          title: 'Family first 30 2',
          slug: 'family-f30-2',
          cityId,
          scope: 'CITY',
          resourceType: 'CITY_REGISTRATION',
          audiences: ['FAMILY'],
          lifecycleStage: ['FIRST_30_DAYS'],
        },
      ],
    });

    await ingestJourneyGapBacklog(new Date('2026-06-17T10:00:00.000Z'));

    const staleRows = await testDb.journeyGapBacklog.findMany({
      where: {
        cityId,
        personaSlug: 'young-family',
        stage: 'FIRST_30_DAYS',
      },
    });

    expect(staleRows.length).toBeGreaterThan(0);
    expect(staleRows.every((row) => row.status === 'DISMISSED' || row.status === 'RESOLVED')).toBe(
      true,
    );
  });
});
