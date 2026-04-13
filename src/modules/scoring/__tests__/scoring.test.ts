/**
 * Unit tests for scoring module.
 *
 * These tests cover pure functions only — no database, no I/O.
 * They should be fast (<10ms each) and run on every save.
 */
import { describe, it, expect } from 'vitest';
import { computeActivityScore, computeCompletenessScore } from '../scoring';

// ─── computeActivityScore ────────────────────────────────────────────────────

describe('computeActivityScore', () => {
  it('returns 0 for a community with no events and no activity', () => {
    expect(computeActivityScore({ eventsLast90Days: 0, lastActivityAt: null })).toBe(0);
  });

  it('returns exactly 50 for a community active today with 0 events', () => {
    const score = computeActivityScore({
      eventsLast90Days: 0,
      lastActivityAt: new Date(),
    });
    expect(score).toBeCloseTo(50, 1);
  });

  it('returns > 50 for a community with recent events', () => {
    const score = computeActivityScore({
      eventsLast90Days: 5,
      lastActivityAt: new Date(),
    });
    expect(score).toBeGreaterThan(50);
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
