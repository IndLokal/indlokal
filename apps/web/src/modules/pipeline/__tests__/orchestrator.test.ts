import { describe, it, expect } from 'vitest';
import {
  computeSimilarity,
  isLikelyStaleEventPage,
  normalizeEventTitleForDedup,
  prefilterLikelyCurrentItems,
} from '../orchestrator';

describe('computeSimilarity', () => {
  it('returns 1 for identical strings', () => {
    expect(computeSimilarity('diwali celebration', 'diwali celebration')).toBe(1);
  });

  it('returns 0 for completely different strings', () => {
    const score = computeSimilarity('abc', 'xyz');
    expect(score).toBe(0);
  });

  it('returns high score for similar strings', () => {
    const score = computeSimilarity('annual diwali celebration 2025', 'annual diwali celebration');
    expect(score).toBeGreaterThan(0.7);
  });

  it('returns lower score for moderately similar strings', () => {
    const score = computeSimilarity('diwali celebration', 'holi celebration');
    // They share "celebration" but differ on the festival name
    expect(score).toBeGreaterThan(0.3);
    expect(score).toBeLessThan(0.9);
  });

  it('handles single-character strings', () => {
    expect(computeSimilarity('a', 'b')).toBe(0);
  });

  it('handles empty strings', () => {
    expect(computeSimilarity('', '')).toBe(1);
    expect(computeSimilarity('', 'abc')).toBe(0);
  });

  it('detects cross-source duplicate event titles', () => {
    // Same event posted on Facebook and Eventbrite
    const score = computeSimilarity(
      'stuttgart tamil sangam diwali fest',
      'stuttgart tamil sangam - diwali fest 2025',
    );
    expect(score).toBeGreaterThan(0.7);
  });

  it('shows high similarity for structurally similar event names', () => {
    const score = computeSimilarity(
      'tamil sangam diwali celebration',
      'tamil sangam pongal celebration',
    );
    // Bigram similarity is high because the names share most words.
    // In practice, date-based dedup catches these — same community, different dates.
    expect(score).toBeGreaterThan(0.8);
  });
});

describe('normalizeEventTitleForDedup', () => {
  it('removes city names and years for cross-source duplicate matching', () => {
    const a = normalizeEventTitleForDedup('FTS Cultural Fest 2026 - Frankfurt');
    const b = normalizeEventTitleForDedup('FTS Cultural Fest Frankfurt am Main 2026');
    expect(a).toBe('fts cultural fest');
    expect(b).toBe('fts cultural fest am main');
  });

  it('keeps core event identity tokens', () => {
    const normalized = normalizeEventTitleForDedup('Tamil Sangam Diwali Celebration 2026');
    expect(normalized).toContain('tamil sangam diwali celebration');
  });
});

describe('isLikelyStaleEventPage', () => {
  it('flags past-events pages without fresh signals', () => {
    expect(
      isLikelyStaleEventPage({
        sourceType: 'DB_COMMUNITY',
        sourceUrl: 'https://example.org/past-events/',
        text: 'Past events from 2024 and 2025.',
        fetchedAt: new Date().toISOString(),
      }),
    ).toBe(true);
  });

  it('flags old-year event schedules without current-year references', () => {
    expect(
      isLikelyStaleEventPage({
        sourceType: 'DB_COMMUNITY',
        sourceUrl: 'https://example.org/2025-event-schedule/',
        text: 'Festival schedule for 2025 only.',
        fetchedAt: new Date().toISOString(),
      }),
    ).toBe(true);
  });

  it('keeps upcoming or current-year event pages', () => {
    expect(
      isLikelyStaleEventPage({
        sourceType: 'DB_COMMUNITY',
        sourceUrl: 'https://example.org/upcoming-events/',
        text: 'Upcoming events for 2026 and 2027.',
        fetchedAt: new Date().toISOString(),
      }),
    ).toBe(false);
  });

  it('keeps mixed-year pages when current-year events are present', () => {
    expect(
      isLikelyStaleEventPage({
        sourceType: 'DB_COMMUNITY',
        sourceUrl: 'https://example.org/2025/12/festival-31-01-2026/',
        text: 'Programme update for 31.01.2026.',
        fetchedAt: new Date().toISOString(),
      }),
    ).toBe(false);
  });
});

describe('prefilterLikelyCurrentItems', () => {
  it('removes likely stale event pages before LLM stages', () => {
    const kept = prefilterLikelyCurrentItems([
      {
        sourceType: 'DB_COMMUNITY',
        sourceUrl: 'https://example.org/past-events/',
        text: 'Past events from 2024 and 2025.',
        fetchedAt: new Date().toISOString(),
      },
      {
        sourceType: 'DB_COMMUNITY',
        sourceUrl: 'https://example.org/upcoming-events/',
        text: 'Upcoming events for 2026.',
        fetchedAt: new Date().toISOString(),
      },
    ]);

    expect(kept).toHaveLength(1);
    expect(kept[0]?.sourceUrl).toBe('https://example.org/upcoming-events/');
  });
});
