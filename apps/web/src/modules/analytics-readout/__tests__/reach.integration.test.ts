/**
 * Integration tests for organizer/host analytics readout (PRD/TDD-0050).
 *
 * @db - requires test database
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { testDb, cleanDb } from '@/test/db-helpers';
import { createCity, createCommunity, createEvent } from '@/test/fixtures';

vi.mock('@/lib/db', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/db')>();
  const { testDb } = await import('@/test/db-helpers');
  return { ...mod, db: testDb };
});

import { getCommunityReach, getHostReach } from '@/modules/analytics-readout';

async function recordInteraction(
  entityType: 'COMMUNITY' | 'EVENT',
  entityId: string,
  interactionType: 'VIEW' | 'CLICK_ACCESS' | 'SAVE',
) {
  await testDb.userInteraction.create({
    data: { entityType, entityId, interactionType },
  });
}

describe('getCommunityReach @db', () => {
  beforeEach(async () => {
    await cleanDb();
  });

  afterAll(async () => {
    await cleanDb();
    await testDb.$disconnect();
  });

  it('returns zeros for a community with no interactions', async () => {
    const city = await createCity(testDb, { slug: 'reach-city-empty', name: 'ReachEmpty' });
    const community = await createCommunity(testDb, {
      cityId: city.id,
      slug: 'reach-empty-comm',
    });

    const reach = await getCommunityReach(community.id);
    expect(reach).toMatchObject({ views: 0, accessClicks: 0, saves: 0 });
    expect(reach.topEvents).toEqual([]);
  });

  it('counts community views, access-clicks and saves', async () => {
    const city = await createCity(testDb, { slug: 'reach-city', name: 'ReachCity' });
    const community = await createCommunity(testDb, { cityId: city.id, slug: 'reach-comm' });

    await recordInteraction('COMMUNITY', community.id, 'VIEW');
    await recordInteraction('COMMUNITY', community.id, 'VIEW');
    await recordInteraction('COMMUNITY', community.id, 'CLICK_ACCESS');
    await recordInteraction('COMMUNITY', community.id, 'SAVE');

    const reach = await getCommunityReach(community.id);
    expect(reach.views).toBe(2);
    expect(reach.accessClicks).toBe(1);
    expect(reach.saves).toBe(1);
  });

  it('computes top events by views/saves', async () => {
    const city = await createCity(testDb, { slug: 'reach-city-ev', name: 'ReachEv' });
    const community = await createCommunity(testDb, { cityId: city.id, slug: 'reach-comm-ev' });
    const event = await createEvent(testDb, {
      cityId: city.id,
      communityId: community.id,
      slug: 'reach-event',
    });

    await recordInteraction('EVENT', event.id, 'VIEW');
    await recordInteraction('EVENT', event.id, 'VIEW');
    await recordInteraction('EVENT', event.id, 'SAVE');

    const reach = await getCommunityReach(community.id);
    expect(reach.topEvents).toHaveLength(1);
    expect(reach.topEvents[0]).toMatchObject({ eventId: event.id, views: 2, saves: 1 });
  });
});

describe('getHostReach @db', () => {
  beforeEach(async () => {
    await cleanDb();
  });

  afterAll(async () => {
    await cleanDb();
    await testDb.$disconnect();
  });

  it('aggregates views/saves over events the host created', async () => {
    const city = await createCity(testDb, { slug: 'host-reach-city', name: 'HostReach' });
    const host = await testDb.user.create({
      data: { email: 'host-reach@example.com', role: 'EVENT_HOST' },
    });
    const event = await createEvent(testDb, {
      cityId: city.id,
      slug: 'host-reach-event',
      createdByUserId: host.id,
    });

    await recordInteraction('EVENT', event.id, 'VIEW');
    await recordInteraction('EVENT', event.id, 'SAVE');
    await recordInteraction('EVENT', event.id, 'SAVE');

    const reach = await getHostReach(host.id);
    expect(reach.views).toBe(1);
    expect(reach.saves).toBe(2);
    expect(reach.topEvents[0]?.eventId).toBe(event.id);
  });

  it('returns zeros when host has no events', async () => {
    const host = await testDb.user.create({
      data: { email: 'host-empty@example.com', role: 'EVENT_HOST' },
    });
    const reach = await getHostReach(host.id);
    expect(reach).toMatchObject({ views: 0, accessClicks: 0, saves: 0, topEvents: [] });
  });
});
