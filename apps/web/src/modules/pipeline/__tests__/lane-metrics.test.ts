import { describe, expect, it } from 'vitest';
import type { ExtractedData, RawContent } from '../types';

function buildEmptyLaneBreakdown() {
  return {
    EVENT: {
      fetched: 0,
      passedFilter: 0,
      extracted: 0,
      queued: 0,
      duplicates: 0,
      noCity: 0,
      past: 0,
      cityConflicts: 0,
    },
    COMMUNITY: {
      fetched: 0,
      passedFilter: 0,
      extracted: 0,
      queued: 0,
      duplicates: 0,
      noCity: 0,
      past: 0,
      cityConflicts: 0,
    },
    RESOURCE: {
      fetched: 0,
      passedFilter: 0,
      extracted: 0,
      queued: 0,
      duplicates: 0,
      noCity: 0,
      past: 0,
      cityConflicts: 0,
    },
    UNKNOWN: {
      fetched: 0,
      passedFilter: 0,
      extracted: 0,
      queued: 0,
      duplicates: 0,
      noCity: 0,
      past: 0,
      cityConflicts: 0,
    },
  };
}

function getLaneMetricKeyForRaw(item: RawContent) {
  return item._lane ?? 'UNKNOWN';
}

function getLaneMetricKeyForExtracted(item: ExtractedData) {
  return item.type;
}

describe('lane metric helpers shape', () => {
  it('maps unlabeled raw items to UNKNOWN and extracted items to their entity lane', () => {
    const rawUnknown: RawContent = {
      sourceType: 'GOOGLE_SEARCH',
      sourceUrl: 'https://example.org/unknown',
      text: 'generic page',
      fetchedAt: new Date().toISOString(),
    };
    const rawEvent: RawContent = {
      sourceType: 'GOOGLE_SEARCH',
      sourceUrl: 'https://example.org/event',
      text: 'event page',
      fetchedAt: new Date().toISOString(),
      _lane: 'EVENT',
    };
    const extractedCommunity: ExtractedData = {
      type: 'COMMUNITY',
      name: 'Community',
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
      confidence: 0.9,
      fieldConfidence: {},
    };

    expect(getLaneMetricKeyForRaw(rawUnknown)).toBe('UNKNOWN');
    expect(getLaneMetricKeyForRaw(rawEvent)).toBe('EVENT');
    expect(getLaneMetricKeyForExtracted(extractedCommunity)).toBe('COMMUNITY');
  });

  it('initializes all lane counters to zero', () => {
    const breakdown = buildEmptyLaneBreakdown();

    expect(breakdown.EVENT).toEqual({
      fetched: 0,
      passedFilter: 0,
      extracted: 0,
      queued: 0,
      duplicates: 0,
      noCity: 0,
      past: 0,
      cityConflicts: 0,
    });
    expect(breakdown.UNKNOWN.fetched).toBe(0);
    expect(breakdown.RESOURCE.queued).toBe(0);
  });
});
