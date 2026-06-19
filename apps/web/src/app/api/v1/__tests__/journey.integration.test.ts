/**
 * Integration tests — GET /api/v1/cities/:slug/journey (PRD/TDD-0052).
 *
 * Exercises the composed Journey Layer end-to-end against the test database:
 * persona validation, the flag + allowlist gate, city activeness, and the
 * action-or-drop / density behaviour over real seeded rows.
 *
 * @db - requires the test database.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';

// The Journey Layer is flag-gated; enable it (and the default allowlist covers
// stuttgart:young-family) BEFORE the route/flags modules are imported.
process.env.JOURNEY_LAYER_ENABLED = 'true';
process.env.JOURNEY_CITY_PERSONA_ALLOWLIST = 'stuttgart:young-family';

import { testDb, cleanDb } from '@/test/db-helpers';
import { createCity, createCommunity, createEvent, createResource } from '@/test/fixtures';

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

const { GET } = await import('@/app/api/v1/cities/[slug]/journey/route');

function makeReq(slug: string, qs: string) {
  return new NextRequest(`http://localhost/api/v1/cities/${slug}/journey${qs}`);
}

function ctx(slug: string) {
  return { params: Promise.resolve({ slug }) };
}

let cityId: string;

beforeEach(async () => {
  await cleanDb();
  const city = await createCity(testDb, { slug: 'stuttgart', name: 'Stuttgart' });
  cityId = city.id;
});

afterAll(async () => {
  await testDb.$disconnect();
});

async function seedFamilyJourney() {
  // PRE_ARRIVAL ×2
  await createResource(testDb, {
    title: 'Family reunion visa',
    slug: 'jt-family-visa',
    scope: 'CITY',
    cityId,
    audiences: ['FAMILY'],
    lifecycleStage: ['PRE_ARRIVAL'],
  });
  await createResource(testDb, {
    title: 'Apartment search',
    slug: 'jt-apartment',
    scope: 'CITY',
    cityId,
    audiences: ['FAMILY'],
    lifecycleStage: ['PRE_ARRIVAL'],
  });
  // FIRST_30_DAYS ×2 (one essential)
  await createResource(testDb, {
    title: 'Anmeldung',
    slug: 'jt-anmeldung',
    scope: 'CITY',
    cityId,
    audiences: ['FAMILY'],
    lifecycleStage: ['FIRST_30_DAYS'],
    isEssential: true,
    priority: 90,
  });
  await createResource(testDb, {
    title: 'Kindergeld',
    slug: 'jt-kindergeld',
    scope: 'CITY',
    cityId,
    audiences: ['FAMILY'],
    lifecycleStage: ['FIRST_30_DAYS'],
  });

  // A family community WITH a join channel (actionable) …
  const withChannel = await createCommunity(testDb, {
    cityId,
    slug: 'jt-family-group',
    name: 'Indian Families Stuttgart',
    personaSegments: ['family'],
    status: 'ACTIVE',
    trustScore: 60,
  });
  await testDb.accessChannel.create({
    data: {
      communityId: withChannel.id,
      channelType: 'WHATSAPP',
      url: 'https://chat.example/family',
      isPrimary: true,
      isVerified: true,
    },
  });
  // … and one WITHOUT any channel (must be dropped).
  await createCommunity(testDb, {
    cityId,
    slug: 'jt-no-channel',
    name: 'Channel-less Family Group',
    personaSegments: ['family'],
    status: 'ACTIVE',
    trustScore: 90,
  });

  // An upcoming published event.
  await createEvent(testDb, {
    cityId,
    slug: 'jt-family-event',
    title: 'Family picnic',
    moderationState: 'PUBLISHED',
  });
}

describe('GET /api/v1/cities/:slug/journey', () => {
  it('composes a Stuttgart × FAMILY journey from seeded data', async () => {
    await seedFamilyJourney();

    const res = await GET(makeReq('stuttgart', '?persona=FAMILY'), ctx('stuttgart'));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.persona).toBe('FAMILY');
    expect(body.personaSlug).toBe('young-family');
    expect(body.cityName).toBe('Stuttgart');
    expect(body.blockCount).toBeGreaterThanOrEqual(6);

    const allBlocks = body.stages.flatMap((s: { blocks: unknown[] }) => s.blocks);
    // action-or-drop: every block ends in an action.
    for (const b of allBlocks) expect(b.action?.label?.length).toBeGreaterThan(0);

    // The channel-less community was dropped.
    const communityBlocks = allBlocks.filter(
      (b: { entityKind: string }) => b.entityKind === 'community',
    );
    expect(communityBlocks).toHaveLength(1);
    expect(communityBlocks[0].title).toBe('Indian Families Stuttgart');

    // Dense enough to be promoted.
    expect(body.promoted).toBe(true);
  });

  it('orders the essential resource first within FIRST_30_DAYS', async () => {
    await seedFamilyJourney();
    const res = await GET(makeReq('stuttgart', '?persona=FAMILY'), ctx('stuttgart'));
    const body = await res.json();
    const stage = body.stages.find((s: { stage: string }) => s.stage === 'FIRST_30_DAYS');
    expect(stage.blocks[0].title).toBe('Anmeldung');
    expect(stage.blocks[0].badge).toBe('Essential');
  });

  it('restricts to a single stage when ?stage= is provided', async () => {
    await seedFamilyJourney();
    const res = await GET(
      makeReq('stuttgart', '?persona=FAMILY&stage=PRE_ARRIVAL'),
      ctx('stuttgart'),
    );
    const body = await res.json();
    expect(body.stages.every((s: { stage: string }) => s.stage === 'PRE_ARRIVAL')).toBe(true);
    expect(body.promoted).toBe(false);
  });

  it('rejects an unknown persona with 400', async () => {
    const res = await GET(makeReq('stuttgart', '?persona=WIZARD'), ctx('stuttgart'));
    expect(res.status).toBe(400);
  });

  it('404s a persona that is not allowlisted for the city', async () => {
    // STUDENT is a valid persona but not in the default allowlist.
    const res = await GET(makeReq('stuttgart', '?persona=STUDENT'), ctx('stuttgart'));
    expect(res.status).toBe(404);
  });

  it('404s an unknown city', async () => {
    const res = await GET(makeReq('atlantis', '?persona=FAMILY'), ctx('atlantis'));
    expect(res.status).toBe(404);
  });

  it('404s an inactive city', async () => {
    await testDb.city.update({ where: { id: cityId }, data: { isActive: false } });
    const res = await GET(makeReq('stuttgart', '?persona=FAMILY'), ctx('stuttgart'));
    expect(res.status).toBe(404);
  });
});
