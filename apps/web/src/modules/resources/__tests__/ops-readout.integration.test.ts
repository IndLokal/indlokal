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

const { getSection17OpsReadout } = await import('../ops-readout');
const { ingestJourneyGapBacklog } = await import('@/modules/journeys/ops-backlog');

let cityId: string;

beforeEach(async () => {
  await cleanDb();
  const city = await createCity(testDb, { slug: 'stuttgart', name: 'Stuttgart', isActive: true });
  cityId = city.id;
});

afterAll(async () => {
  await testDb.$disconnect();
});

describe('section 17 ops readout', () => {
  it('returns a queryable metrics contract', async () => {
    const resource = await createResource(testDb, {
      title: 'Visa support',
      slug: 'visa-support',
      scope: 'CITY',
      cityId,
      audiences: ['NEWCOMER'],
      lifecycleStage: ['PRE_ARRIVAL'],
      source: 'ADMIN_SEED',
      lastReviewedAt: new Date('2026-06-01T00:00:00.000Z'),
      reviewCadenceDays: 120,
      metadata: {
        trust: { band: 'STRONG_SOURCE', verificationMethod: 'Official source verification' },
      },
    });

    await testDb.userInteraction.create({
      data: {
        cityId,
        entityType: 'RESOURCE',
        entityId: resource.id,
        interactionType: 'CLICK_ACCESS',
        metadata: { source_event: 'resources_essentials_click', is_stale: false },
      },
    });

    await ingestJourneyGapBacklog(new Date('2026-06-10T10:00:00.000Z'));

    const readout = await getSection17OpsReadout(new Date('2026-06-10T10:00:00.000Z'));

    expect(readout.generatedAt).toBeTruthy();
    expect(typeof readout.trustedJourneyResourceCoveragePct).toBe('number');
    expect(typeof readout.resourcesWithinTtlPct).toBe('number');
    expect(typeof readout.resourcesWithProvenanceMetadataPct).toBe('number');
    expect(typeof readout.staleExposureRatePct).toBe('number');
    expect(typeof readout.outdatedCorrectionTurnaroundDays).toBe('number');
    expect(typeof readout.trustBandActionRatePct.strongSource).toBe('number');
    expect(typeof readout.antiMetrics.overdueJourneyGapBacklogRatePct).toBe('number');
  });
});
