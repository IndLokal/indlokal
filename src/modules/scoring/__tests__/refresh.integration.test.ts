/**
 * Integration tests for scoring refresh.
 *
 * Validates that refreshCommunityScore correctly computes
 * and persists scores based on community content.
 *
 * @db — requires test database
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { testDb, cleanDb } from '@/test/db-helpers';
import { createCity, createCommunity, createEvent } from '@/test/fixtures';

// We import the scoring function and point it at our test DB
// by mocking the db import
import { vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: testDb,
}));

import { refreshCommunityScore } from '@/modules/scoring';

describe('refreshCommunityScore @db', () => {
  let cityId: string;

  beforeEach(async () => {
    await cleanDb();
    const city = await createCity(testDb);
    cityId = city.id;
  });

  afterAll(async () => {
    await cleanDb();
    await testDb.$disconnect();
  });

  it('computes scores for a new community with no events', async () => {
    const community = await createCommunity(testDb, { cityId });
    await refreshCommunityScore(community.id);

    const updated = await testDb.community.findUnique({
      where: { id: community.id },
      select: {
        activityScore: true,
        completenessScore: true,
        trustScore: true,
        scoreBreakdown: true,
      },
    });

    expect(updated).toBeTruthy();
    expect(updated!.activityScore).toBe(0); // no events, no activity
    expect(updated!.completenessScore).toBeGreaterThanOrEqual(0);
    expect(updated!.trustScore).toBeGreaterThanOrEqual(0);
    expect(updated!.scoreBreakdown).toBeTruthy();
  });

  it('increases activity score when community has recent events', async () => {
    const community = await createCommunity(testDb, { cityId });

    // Score with no events
    await refreshCommunityScore(community.id);
    const before = await testDb.community.findUnique({
      where: { id: community.id },
      select: { activityScore: true },
    });

    // Add events
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await createEvent(testDb, {
      cityId,
      communityId: community.id,
      slug: 'event-1',
      startsAt: tomorrow,
    });
    await createEvent(testDb, {
      cityId,
      communityId: community.id,
      slug: 'event-2',
      startsAt: tomorrow,
    });

    await refreshCommunityScore(community.id);
    const after = await testDb.community.findUnique({
      where: { id: community.id },
      select: { activityScore: true },
    });

    expect(after!.activityScore).toBeGreaterThan(before!.activityScore);
  });

  it('increases completeness score when community has description and channels', async () => {
    const community = await createCommunity(testDb, {
      cityId,
      description: 'A great community for Indian expats in Stuttgart.',
    });

    await testDb.accessChannel.create({
      data: {
        communityId: community.id,
        channelType: 'WEBSITE',
        url: 'https://example.com',
        isPrimary: true,
      },
    });

    await refreshCommunityScore(community.id);
    const updated = await testDb.community.findUnique({
      where: { id: community.id },
      select: { completenessScore: true },
    });

    expect(updated!.completenessScore).toBeGreaterThan(0);
  });

  it('increases trust score when community is claimed', async () => {
    const unclaimed = await createCommunity(testDb, { cityId, claimState: 'UNCLAIMED' });
    await refreshCommunityScore(unclaimed.id);
    const unclaimedScore = await testDb.community.findUnique({
      where: { id: unclaimed.id },
      select: { trustScore: true },
    });

    const claimed = await createCommunity(testDb, {
      cityId,
      slug: 'claimed-community',
      claimState: 'CLAIMED',
    });
    await refreshCommunityScore(claimed.id);
    const claimedScore = await testDb.community.findUnique({
      where: { id: claimed.id },
      select: { trustScore: true },
    });

    expect(claimedScore!.trustScore).toBeGreaterThan(unclaimedScore!.trustScore);
  });
});
