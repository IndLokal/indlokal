/**
 * Integration tests — Journey coverage + tagging ops (PRD/TDD-0053).
 *
 * Exercises the real DB path end-to-end:
 *  - the coverage report's READY/THIN verdict matches what `composeJourney`
 *    would actually render (no parallel logic),
 *  - a freshly-tagged resource surfaces in the journey once the resolver cache
 *    is busted (the admin tag-save path),
 *  - pipeline-suggested persona tags stay parked on the PENDING item and are
 *    only written to a real community when a human approves it.
 *
 * @db - requires the test database.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';

import { testDb, cleanDb } from '@/test/db-helpers';
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

const { computeCityCoverage } = await import('@/modules/journeys');
const { composeJourney } = await import('@/modules/journeys/compose');
const { meetsDensityGate } = await import('@/modules/journeys/density');
const { invalidateResolver } = await import('@/modules/resources/resolver');
const { approvePipelineItemRecord } = await import('@/modules/pipeline/review');

let cityId: string;

beforeEach(async () => {
  await cleanDb();
  invalidateResolver();
  const city = await createCity(testDb, { slug: 'stuttgart', name: 'Stuttgart' });
  cityId = city.id;
});

afterAll(async () => {
  await testDb.$disconnect();
});

async function seedReadyFamilyJourney() {
  await createResource(testDb, {
    title: 'Family reunion visa',
    slug: 'cov-family-visa',
    scope: 'CITY',
    cityId,
    audiences: ['FAMILY'],
    lifecycleStage: ['PRE_ARRIVAL'],
  });
  await createResource(testDb, {
    title: 'Apartment search',
    slug: 'cov-apartment',
    scope: 'CITY',
    cityId,
    audiences: ['FAMILY'],
    lifecycleStage: ['PRE_ARRIVAL'],
  });
  await createResource(testDb, {
    title: 'Anmeldung',
    slug: 'cov-anmeldung',
    scope: 'CITY',
    cityId,
    audiences: ['FAMILY'],
    lifecycleStage: ['FIRST_30_DAYS'],
    isEssential: true,
  });
  await createResource(testDb, {
    title: 'Kindergeld',
    slug: 'cov-kindergeld',
    scope: 'CITY',
    cityId,
    audiences: ['FAMILY'],
    lifecycleStage: ['FIRST_30_DAYS'],
  });
  await createResource(testDb, {
    title: 'Schools guide',
    slug: 'cov-schools',
    scope: 'CITY',
    cityId,
    audiences: ['FAMILY'],
    lifecycleStage: ['FIRST_90_DAYS'],
  });
  await createResource(testDb, {
    title: 'Pediatricians',
    slug: 'cov-pediatricians',
    scope: 'CITY',
    cityId,
    audiences: ['FAMILY'],
    lifecycleStage: ['FIRST_90_DAYS'],
  });
}

describe('computeCityCoverage — verdict matches the engine', () => {
  it('reports READY for a dense FAMILY journey, matching composeJourney', async () => {
    await seedReadyFamilyJourney();

    const report = await computeCityCoverage({
      citySlug: 'stuttgart',
      cityName: 'Stuttgart',
      personas: ['FAMILY'],
    });

    const familyRow = report.rows.find((r) => r.persona === 'FAMILY')!;
    expect(familyRow.verdict).toBe('READY');
    expect(report.readyCount).toBe(1);

    // The report can never diverge from what the journey would render.
    invalidateResolver();
    const view = await composeJourney({
      persona: 'FAMILY',
      citySlug: 'stuttgart',
      cityName: 'Stuttgart',
    });
    expect(familyRow.verdict === 'READY').toBe(meetsDensityGate(view.stages));
  });

  it('reports THIN when the journey is under-dense', async () => {
    await createResource(testDb, {
      title: 'Lonely resource',
      slug: 'cov-lonely',
      scope: 'CITY',
      cityId,
      audiences: ['FAMILY'],
      lifecycleStage: ['PRE_ARRIVAL'],
    });

    const report = await computeCityCoverage({
      citySlug: 'stuttgart',
      cityName: 'Stuttgart',
      personas: ['FAMILY'],
    });
    const familyRow = report.rows.find((r) => r.persona === 'FAMILY')!;
    expect(familyRow.verdict).toBe('THIN');
    expect(familyRow.gaps.length).toBeGreaterThan(0);
  });
});

describe('admin tag-save → resolver cache → journey surfacing', () => {
  it('surfaces a resource in the journey after it is tagged and the cache is busted', async () => {
    await seedReadyFamilyJourney();

    // An untagged resource: invisible to the journey until tagged.
    const untagged = await createResource(testDb, {
      title: 'Driving license guide',
      slug: 'cov-driving',
      scope: 'CITY',
      cityId,
      audiences: [],
      lifecycleStage: [],
    });

    invalidateResolver();
    const before = await composeJourney({
      persona: 'FAMILY',
      citySlug: 'stuttgart',
      cityName: 'Stuttgart',
    });
    const titlesBefore = before.stages.flatMap((s) => s.blocks.map((b) => b.title));
    expect(titlesBefore).not.toContain('Driving license guide');

    // Simulate the admin journey-tag save (DB write + resolver invalidation).
    await testDb.resource.update({
      where: { id: untagged.id },
      data: { audiences: ['FAMILY'], lifecycleStage: ['FIRST_90_DAYS'] },
    });
    invalidateResolver();

    const after = await composeJourney({
      persona: 'FAMILY',
      citySlug: 'stuttgart',
      cityName: 'Stuttgart',
    });
    const titlesAfter = after.stages.flatMap((s) => s.blocks.map((b) => b.title));
    expect(titlesAfter).toContain('Driving license guide');
  });
});

describe('pipeline suggested tags — applied only on approval', () => {
  it('keeps suggestions on the PENDING item and writes persona tags when approved', async () => {
    const pending = await testDb.pipelineItem.create({
      data: {
        entityType: 'COMMUNITY',
        sourceType: 'GOOGLE_SEARCH',
        sourceUrl: 'https://example.org/desi-students',
        rawContent: 'Stuttgart Desi Students Network',
        cityId,
        confidence: 0.8,
        extractedData: {
          type: 'COMMUNITY',
          name: 'Stuttgart Desi Students Network',
          description: 'A student community.',
          cityName: 'Stuttgart',
          categories: [],
          languages: ['Hindi'],
          websiteUrl: null,
          facebookUrl: null,
          instagramUrl: null,
          whatsappUrl: null,
          telegramUrl: null,
          contactEmail: null,
          confidence: 0.8,
          fieldConfidence: {},
        },
        metadata: { suggestedTags: { personaSegments: ['student', 'professional'] } },
      },
    });

    // Suggestion is journey-ineligible while PENDING: no community exists yet.
    const preCount = await testDb.community.count({
      where: { name: 'Stuttgart Desi Students Network' },
    });
    expect(preCount).toBe(0);

    await approvePipelineItemRecord(pending.id, { reviewedBy: 'test-admin' });

    const created = await testDb.community.findFirst({
      where: { name: 'Stuttgart Desi Students Network' },
      select: { personaSegments: true, status: true },
    });
    expect(created).not.toBeNull();
    expect(new Set(created!.personaSegments)).toEqual(new Set(['student', 'professional']));
    // Admin-approved (not auto) communities go straight to ACTIVE.
    expect(created!.status).toBe('ACTIVE');
  });

  it('writes no persona tags when the item carries no suggestions', async () => {
    const pending = await testDb.pipelineItem.create({
      data: {
        entityType: 'COMMUNITY',
        sourceType: 'GOOGLE_SEARCH',
        sourceUrl: 'https://example.org/plain',
        rawContent: 'Plain community',
        cityId,
        confidence: 0.7,
        extractedData: {
          type: 'COMMUNITY',
          name: 'Plain Stuttgart Group',
          description: null,
          cityName: 'Stuttgart',
          categories: [],
          languages: [],
          websiteUrl: null,
          facebookUrl: null,
          instagramUrl: null,
          whatsappUrl: null,
          telegramUrl: null,
          contactEmail: null,
          confidence: 0.7,
          fieldConfidence: {},
        },
      },
    });

    await approvePipelineItemRecord(pending.id, { reviewedBy: 'test-admin' });

    const created = await testDb.community.findFirst({
      where: { name: 'Plain Stuttgart Group' },
      select: { personaSegments: true },
    });
    expect(created).not.toBeNull();
    expect(created!.personaSegments).toEqual([]);
  });
});
