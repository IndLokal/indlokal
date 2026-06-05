/**
 * Journey tag suggestion unit tests — PRD/TDD-0053 §6.
 *
 * Suggestions are deterministic keyword inferences over already-extracted
 * fields, restricted to the shipped persona-segment taxonomy.
 */
import { describe, expect, it } from 'vitest';
import { communityOptions } from '@indlokal/shared';
import { suggestCommunityPersonaSegments } from '../journey-tags';

describe('suggestCommunityPersonaSegments', () => {
  it('infers segments from the community name', () => {
    expect(
      suggestCommunityPersonaSegments({ name: 'Stuttgart Tamil Students Association' }),
    ).toEqual(['student']);
  });

  it('infers family from parent/kids language in the description', () => {
    const segments = suggestCommunityPersonaSegments({
      name: 'Indian Parents Group',
      description: 'A circle for families with young kids in Stuttgart.',
    });
    expect(segments).toContain('family');
  });

  it('unions multiple matches across name, description, and categories', () => {
    const segments = suggestCommunityPersonaSegments({
      name: 'Desi Foodies & Cricket Club',
      description: 'Cooking meetups and weekend cricket.',
      categories: ['sports', 'food'],
    });
    expect(new Set(segments)).toEqual(new Set(['food', 'sports']));
  });

  it('maps temple/spiritual language to the religious segment', () => {
    expect(suggestCommunityPersonaSegments({ name: 'Stuttgart Hindu Temple & Satsang' })).toContain(
      'religious',
    );
  });

  it('returns an empty array when nothing matches (prefers no suggestion over a wrong one)', () => {
    expect(suggestCommunityPersonaSegments({ name: 'Generic Meetup', description: null })).toEqual(
      [],
    );
  });

  it('only ever emits values from the shipped taxonomy', () => {
    const segments = suggestCommunityPersonaSegments({
      name: 'Students, Parents, Professionals, Temple, Cricket, Food, Dance Club',
    });
    for (const s of segments) {
      expect(communityOptions.PERSONA_SEGMENT_VALUES).toContain(s);
    }
  });
});
