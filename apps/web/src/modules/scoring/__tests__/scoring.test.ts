/**
 * Unit tests for scoring module.
 *
 * These tests cover pure functions only — no database, no I/O.
 * They should be fast (<10ms each) and run on every save.
 */
import { describe, it, expect } from 'vitest';
import {
  computeActivityScore,
  computeCompletenessScore,
  computeTrustScore,
  computeFinalScore,
  detectTrending,
} from '../scoring';

// ─── computeActivityScore ────────────────────────────────────────────────────

describe('computeActivityScore', () => {
  it('returns 0 for a community with no events and no activity', () => {
    expect(computeActivityScore({ eventsLast90Days: 0, lastActivityAt: null })).toBe(0);
  });

  it('returns exactly 40 for a community active today with 0 events (recency max)', () => {
    const score = computeActivityScore({
      eventsLast90Days: 0,
      lastActivityAt: new Date(),
    });
    expect(score).toBeCloseTo(40, 1);
  });

  it('returns > 40 for a community with recent events', () => {
    const score = computeActivityScore({
      eventsLast90Days: 5,
      lastActivityAt: new Date(),
    });
    expect(score).toBeGreaterThan(40);
  });

  it('adds engagement score for communities with views', () => {
    const withViews = computeActivityScore({
      eventsLast90Days: 0,
      lastActivityAt: new Date(),
      viewsLast30Days: 10,
    });
    const withoutViews = computeActivityScore({
      eventsLast90Days: 0,
      lastActivityAt: new Date(),
      viewsLast30Days: 0,
    });
    expect(withViews).toBeGreaterThan(withoutViews);
  });

  it('caps score at 100 (max events + max recency)', () => {
    const score = computeActivityScore({
      eventsLast90Days: 1000, // far above log cap
      lastActivityAt: new Date(),
    });
    expect(score).toBeLessThanOrEqual(100);
  });

  it('decays recency score to 0 after STALE_THRESHOLD_DAYS', () => {
    const staleDate = new Date();
    staleDate.setDate(staleDate.getDate() - 91); // just past 90-day threshold
    const score = computeActivityScore({
      eventsLast90Days: 0,
      lastActivityAt: staleDate,
    });
    expect(score).toBe(0);
  });

  it('produces higher score for more recent activity', () => {
    const recent = computeActivityScore({
      eventsLast90Days: 3,
      lastActivityAt: new Date(),
    });
    const older = new Date();
    older.setDate(older.getDate() - 60);
    const stale = computeActivityScore({
      eventsLast90Days: 3,
      lastActivityAt: older,
    });
    expect(recent).toBeGreaterThan(stale);
  });
});

// ─── computeCompletenessScore ────────────────────────────────────────────────

describe('computeCompletenessScore', () => {
  const fullProfile = {
    hasDescription: true,
    hasDescriptionLong: true,
    hasLogo: true,
    hasCoverImage: true,
    categoryCount: 2,
    accessChannelCount: 1,
    hasLanguages: true,
    hasPersonas: true,
  };

  it('returns 100 for a fully complete profile', () => {
    expect(computeCompletenessScore(fullProfile)).toBe(100);
  });

  it('returns 0 for an empty profile', () => {
    expect(
      computeCompletenessScore({
        hasDescription: false,
        hasDescriptionLong: false,
        hasLogo: false,
        hasCoverImage: false,
        categoryCount: 0,
        accessChannelCount: 0,
        hasLanguages: false,
        hasPersonas: false,
      }),
    ).toBe(0);
  });

  it('awards points for description (15pts)', () => {
    const base = computeCompletenessScore({ ...fullProfile, hasDescription: false });
    expect(fullProfile.hasDescription && computeCompletenessScore(fullProfile) - base).toBe(15);
  });

  it('awards most weight to having an access channel (20pts)', () => {
    const without = computeCompletenessScore({ ...fullProfile, accessChannelCount: 0 });
    expect(computeCompletenessScore(fullProfile) - without).toBe(20);
  });

  it('caps at 100 even if somehow all flags true and high counts', () => {
    expect(computeCompletenessScore(fullProfile)).toBeLessThanOrEqual(100);
  });
});

// ─── computeTrustScore ───────────────────────────────────────────────────────

describe('computeTrustScore', () => {
  it('returns 0 for unclaimed community with no signals', () => {
    expect(computeTrustScore({ trustSignalTypes: [], claimState: 'UNCLAIMED' })).toBe(0);
  });

  it('gives 50 pts for ADMIN_VERIFIED signal', () => {
    const score = computeTrustScore({
      trustSignalTypes: ['ADMIN_VERIFIED'],
      claimState: 'UNCLAIMED',
    });
    expect(score).toBe(50);
  });

  it('gives 25 pts for CLAIMED state alone', () => {
    const score = computeTrustScore({ trustSignalTypes: [], claimState: 'CLAIMED' });
    expect(score).toBe(25);
  });

  it('combines ADMIN_VERIFIED + CLAIMED for 75 pts', () => {
    const score = computeTrustScore({
      trustSignalTypes: ['ADMIN_VERIFIED'],
      claimState: 'CLAIMED',
    });
    expect(score).toBe(75);
  });

  it('gives CLAIM_PENDING 5 pts bonus', () => {
    const score = computeTrustScore({ trustSignalTypes: [], claimState: 'CLAIM_PENDING' });
    expect(score).toBe(5);
  });

  it('caps at 100', () => {
    const score = computeTrustScore({
      trustSignalTypes: ['ADMIN_VERIFIED', 'SUBMITTER_VERIFIED', 'EXTRA_A', 'EXTRA_B'],
      claimState: 'CLAIMED',
    });
    expect(score).toBeLessThanOrEqual(100);
  });
});

// ─── detectTrending ──────────────────────────────────────────────────────────

describe('detectTrending', () => {
  it('returns false when recent events < 2', () => {
    expect(detectTrending({ eventsLast30Days: 1, eventsPrior30Days: 0 })).toBe(false);
  });

  it('returns true when recent >= 2 and prior = 0', () => {
    expect(detectTrending({ eventsLast30Days: 2, eventsPrior30Days: 0 })).toBe(true);
  });

  it('returns true when recent is 2× prior', () => {
    expect(detectTrending({ eventsLast30Days: 4, eventsPrior30Days: 2 })).toBe(true);
  });

  it('returns false when recent equals prior', () => {
    expect(detectTrending({ eventsLast30Days: 3, eventsPrior30Days: 3 })).toBe(false);
  });
});

// ─── computeFinalScore ───────────────────────────────────────────────────────

describe('computeFinalScore', () => {
  it('returns weighted composite of three sub-scores', () => {
    // 100 * 0.5 + 100 * 0.3 + 100 * 0.2 = 100
    expect(computeFinalScore({ activityScore: 100, completenessScore: 100, trustScore: 100 })).toBe(
      100,
    );
  });

  it('returns 0 when all sub-scores are 0', () => {
    expect(computeFinalScore({ activityScore: 0, completenessScore: 0, trustScore: 0 })).toBe(0);
  });

  it('weights activity highest (0.5)', () => {
    const activityOnly = computeFinalScore({
      activityScore: 100,
      completenessScore: 0,
      trustScore: 0,
    });
    const completenessOnly = computeFinalScore({
      activityScore: 0,
      completenessScore: 100,
      trustScore: 0,
    });
    expect(activityOnly).toBeGreaterThan(completenessOnly);
  });
});
