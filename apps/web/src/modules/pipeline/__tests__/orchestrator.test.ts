import { describe, it, expect } from 'vitest';
import { computeSimilarity } from '../orchestrator';

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
