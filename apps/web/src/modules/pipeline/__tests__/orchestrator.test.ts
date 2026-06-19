import { describe, it, expect } from 'vitest';
import {
  computeSimilarity,
  isCityWithinCommunityCoverage,
  isLikelyStaleEventPage,
  normalizeEventTitleForDedup,
  prefilterLaneAwareItems,
  prefilterLikelyCurrentItems,
  resolveEventCityDecision,
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
    // In practice, date-based dedup catches these - same community, different dates.
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

describe('prefilterLaneAwareItems', () => {
  it('drops EVENT lane items without event/date signals', () => {
    const kept = prefilterLaneAwareItems([
      {
        sourceType: 'WEBSITE_SCRAPE',
        sourceUrl: 'https://example.org/about-us',
        text: 'About our community and mission statement.',
        fetchedAt: new Date().toISOString(),
        _lane: 'EVENT',
      },
    ]);

    expect(kept).toEqual([]);
  });

  it('keeps EVENT lane items with clear event signals', () => {
    const kept = prefilterLaneAwareItems([
      {
        sourceType: 'WEBSITE_SCRAPE',
        sourceUrl: 'https://example.org/upcoming-events/',
        text: 'Upcoming events for 2026. Join us on 15.08.2026.',
        fetchedAt: new Date().toISOString(),
        _lane: 'EVENT',
      },
    ]);

    expect(kept).toHaveLength(1);
  });

  it('drops COMMUNITY lane items without organization/community signals', () => {
    const kept = prefilterLaneAwareItems([
      {
        sourceType: 'GOOGLE_SEARCH',
        sourceUrl: 'https://example.org/random-page',
        text: 'Welcome to our landing page.',
        fetchedAt: new Date().toISOString(),
        _lane: 'COMMUNITY',
      },
    ]);

    expect(kept).toEqual([]);
  });

  it('keeps COMMUNITY lane items with community signals', () => {
    const kept = prefilterLaneAwareItems([
      {
        sourceType: 'GOOGLE_SEARCH',
        sourceUrl: 'https://example.org/association',
        text: 'Indian Association community network for students and professionals.',
        fetchedAt: new Date().toISOString(),
        _lane: 'COMMUNITY',
      },
    ]);

    expect(kept).toHaveLength(1);
  });

  it('drops RESOURCE lane items from non-strong evidence domains', () => {
    const kept = prefilterLaneAwareItems([
      {
        sourceType: 'WEBSITE_SCRAPE',
        sourceUrl: 'https://example.org/resource-guide',
        text: 'Helpful relocation information.',
        fetchedAt: new Date().toISOString(),
        _lane: 'RESOURCE',
      },
    ]);

    expect(kept).toEqual([]);
  });

  it('keeps RESOURCE lane items from strong official domains', () => {
    const kept = prefilterLaneAwareItems([
      {
        sourceType: 'WEBSITE_SCRAPE',
        sourceUrl: 'https://www.cgimunich.gov.in/',
        text: 'Official consular services portal.',
        fetchedAt: new Date().toISOString(),
        _lane: 'RESOURCE',
      },
    ]);

    expect(kept).toHaveLength(1);
  });
});

describe('resolveEventCityDecision', () => {
  const cities = [
    { id: 'city-1', slug: 'stuttgart', name: 'Stuttgart' },
    { id: 'city-2', slug: 'karlsruhe', name: 'Karlsruhe' },
  ];
  const cityBySlug = new Map([
    ['stuttgart', { id: 'city-1', name: 'Stuttgart' }],
    ['karlsruhe', { id: 'city-2', name: 'Karlsruhe' }],
  ]);

  it('prefers deterministic event location signals over conflicting llm and hint cities', () => {
    const resolution = resolveEventCityDecision(
      {
        type: 'EVENT',
        title: 'Summer meetup',
        description: null,
        date: '2026-08-15',
        time: '18:00',
        endDate: null,
        endTime: null,
        venueName: 'Stuttgart Hall',
        venueAddress: 'Stuttgart, Germany',
        cityName: 'Karlsruhe',
        isOnline: false,
        isFree: true,
        cost: null,
        costType: 'FREE',
        priceAmount: null,
        priceCurrency: null,
        costNote: null,
        accessType: 'OPEN_ENTRY',
        requiresRegistration: false,
        requiresApproval: false,
        entryNote: null,
        registrationUrl: null,
        imageUrl: null,
        hostCommunity: null,
        categories: [],
        languages: [],
        confidence: 0.9,
        fieldConfidence: {},
      },
      {
        sourceType: 'DB_COMMUNITY',
        sourceUrl: 'https://example.org/events',
        text: 'Event details',
        fetchedAt: new Date().toISOString(),
        _hintCitySlug: 'karlsruhe',
      },
      cities,
      cityBySlug,
      null,
      undefined,
    );

    expect(resolution.cityId).toBe('city-1');
    expect(resolution.resolutionSource).toBe('signal');
    expect(resolution.cityConflict).toBe(true);
  });

  it('marks ambiguous multi-city signals as pending with fallback city', () => {
    const resolution = resolveEventCityDecision(
      {
        type: 'EVENT',
        title: 'Stuttgart and Karlsruhe cultural exchange',
        description: null,
        date: '2026-09-01',
        time: '19:00',
        endDate: null,
        endTime: null,
        venueName: 'Community Hall',
        venueAddress: 'Stuttgart and Karlsruhe',
        cityName: null,
        isOnline: false,
        isFree: true,
        cost: null,
        costType: 'FREE',
        priceAmount: null,
        priceCurrency: null,
        costNote: null,
        accessType: 'OPEN_ENTRY',
        requiresRegistration: false,
        requiresApproval: false,
        entryNote: null,
        registrationUrl: null,
        imageUrl: null,
        hostCommunity: null,
        categories: [],
        languages: [],
        confidence: 0.9,
        fieldConfidence: {},
      },
      {
        sourceType: 'DB_COMMUNITY',
        sourceUrl: 'https://example.org/events',
        text: 'Event details',
        fetchedAt: new Date().toISOString(),
      },
      cities,
      cityBySlug,
      { id: 'city-1', name: 'Stuttgart' },
      'stuttgart',
    );

    expect(resolution.cityId).toBe('city-1');
    expect(resolution.isCityPending).toBe(true);
    expect(resolution.resolutionSource).toBe('fallback');
  });
});

describe('isCityWithinCommunityCoverage', () => {
  it('allows events when community coverage is unavailable', () => {
    expect(isCityWithinCommunityCoverage('city-1', undefined)).toBe(true);
  });

  it('allows events within metro/satellite community coverage', () => {
    const allowed = new Set(['city-1', 'city-2', 'city-3']);
    expect(isCityWithinCommunityCoverage('city-2', allowed)).toBe(true);
  });

  it('rejects events outside community coverage', () => {
    const allowed = new Set(['city-1', 'city-2']);
    expect(isCityWithinCommunityCoverage('city-4', allowed)).toBe(false);
  });
});
