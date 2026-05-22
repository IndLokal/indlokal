import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SearchRegion, SearchStrategy } from '../types';

const mocks = vi.hoisted(() => ({
  findCities: vi.fn(),
  groupCommunities: vi.fn(),
  getKeywordStrategies: vi.fn(),
  getPinnedStrategies: vi.fn(),
  getDbCommunityStrategies: vi.fn(),
  getApprovedDynamicKeywords: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    city: { findMany: mocks.findCities },
    community: { groupBy: mocks.groupCommunities },
  },
}));

vi.mock('../config', () => ({
  getKeywordStrategies: mocks.getKeywordStrategies,
  getPinnedStrategies: mocks.getPinnedStrategies,
}));

vi.mock('../db-sources', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../db-sources')>();
  return {
    ...actual,
    getDbCommunityStrategies: mocks.getDbCommunityStrategies,
  };
});

vi.mock('../intelligence', () => ({
  getApprovedDynamicKeywords: mocks.getApprovedDynamicKeywords,
}));

const originalEnv = process.env;

const regions: SearchRegion[] = [
  {
    id: 'baden-wuerttemberg',
    label: 'Baden-Württemberg',
    searchCenter: 'Stuttgart, Germany',
    citySlugs: ['stuttgart', 'karlsruhe'],
    enabled: true,
  },
];

const keywordStrategies: (SearchStrategy & { kind: 'keyword_search' })[] = [
  {
    id: 'eventbrite-keyword',
    sourceType: 'EVENTBRITE',
    kind: 'keyword_search',
    label: 'Eventbrite',
    enabled: true,
    keywords: ['fallback event'],
    radiusKm: 50,
  },
  {
    id: 'google-cse-keyword',
    sourceType: 'GOOGLE_SEARCH',
    kind: 'keyword_search',
    label: 'Google',
    enabled: true,
    keywords: ['fallback google'],
    radiusKm: 100,
  },
  {
    id: 'duckduckgo-keyword',
    sourceType: 'DUCKDUCKGO',
    kind: 'keyword_search',
    label: 'DuckDuckGo',
    enabled: true,
    keywords: ['fallback ddg'],
    radiusKm: 100,
  },
];

describe('buildPipelineSourcePlan', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env = { ...originalEnv };
    delete process.env.EVENTBRITE_API_KEY;
    delete process.env.GOOGLE_CSE_API_KEY;
    delete process.env.GOOGLE_CSE_ID;
    delete process.env.PIPELINE_FORCE_KEYWORD_SEARCH;
    delete process.env.PIPELINE_ENABLE_DDG;

    mocks.getKeywordStrategies.mockReturnValue(keywordStrategies);
    mocks.getPinnedStrategies.mockReturnValue([]);
    mocks.getDbCommunityStrategies.mockResolvedValue([]);
    mocks.getApprovedDynamicKeywords.mockResolvedValue([]);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('skips keyword search when DB coverage has no city gaps', async () => {
    const { buildPipelineSourcePlan } = await import('../source-plan');

    mocks.findCities.mockResolvedValue([
      { id: 'city-1', slug: 'stuttgart', name: 'Stuttgart' },
      { id: 'city-2', slug: 'karlsruhe', name: 'Karlsruhe' },
    ]);
    mocks.groupCommunities.mockResolvedValue([
      { cityId: 'city-1', _count: { _all: 5 } },
      { cityId: 'city-2', _count: { _all: 4 } },
    ]);

    const plan = await buildPipelineSourcePlan(regions, 'cli');

    expect(plan.keywordStrategies).toEqual([]);
    expect(plan.notes).toContain('skipping keyword search: no low-coverage DB city gaps');
  });

  it('targets low-coverage cities and skips unconfigured API sources', async () => {
    const { buildPipelineSourcePlan } = await import('../source-plan');

    process.env.PIPELINE_ENABLE_DDG = '1';
    mocks.findCities.mockResolvedValue([
      { id: 'city-1', slug: 'stuttgart', name: 'Stuttgart' },
      { id: 'city-2', slug: 'karlsruhe', name: 'Karlsruhe' },
    ]);
    mocks.groupCommunities.mockResolvedValue([{ cityId: 'city-1', _count: { _all: 6 } }]);

    const plan = await buildPipelineSourcePlan(regions, 'cli');

    expect(plan.cityGaps).toEqual([{ slug: 'karlsruhe', name: 'Karlsruhe', communityCount: 0 }]);
    expect(plan.keywordStrategies).toHaveLength(1);
    expect(plan.keywordStrategies[0]?.id).toBe('duckduckgo-keyword');
    expect(plan.keywordStrategies[0]?.keywords).toContain('Indian event Karlsruhe');
    expect(plan.keywordStrategies[0]?.keywords).toContain('Indian community group Karlsruhe');
    expect(plan.notes).toContain(
      'skipping eventbrite-keyword: required API credentials are not configured',
    );
    expect(plan.notes).toContain(
      'skipping google-cse-keyword: required API credentials are not configured',
    );
  });

  it('skips DuckDuckGo unless explicitly enabled', async () => {
    const { buildPipelineSourcePlan } = await import('../source-plan');

    mocks.findCities.mockResolvedValue([
      { id: 'city-1', slug: 'stuttgart', name: 'Stuttgart' },
      { id: 'city-2', slug: 'karlsruhe', name: 'Karlsruhe' },
    ]);
    mocks.groupCommunities.mockResolvedValue([{ cityId: 'city-1', _count: { _all: 6 } }]);

    const plan = await buildPipelineSourcePlan(regions, 'cli');

    expect(plan.keywordStrategies).toEqual([]);
    expect(plan.notes).toContain(
      'skipping duckduckgo-keyword: disabled by default; set PIPELINE_ENABLE_DDG=1 to enable',
    );
  });

  it('prioritizes DB event pages when pinned sources are capped', async () => {
    const { buildPipelineSourcePlan } = await import('../source-plan');

    process.env.PIPELINE_DB_PINNED_LIMIT = '2';
    mocks.findCities.mockResolvedValue([{ id: 'city-1', slug: 'stuttgart', name: 'Stuttgart' }]);
    mocks.groupCommunities.mockResolvedValue([{ cityId: 'city-1', _count: { _all: 6 } }]);
    mocks.getDbCommunityStrategies.mockResolvedValue([
      {
        id: 'community-homepage',
        sourceType: 'DB_COMMUNITY',
        kind: 'pinned_url',
        label: 'Community homepage',
        enabled: true,
        url: 'https://example.org/',
      },
      {
        id: 'community-about',
        sourceType: 'DB_COMMUNITY',
        kind: 'pinned_url',
        label: 'Community about',
        enabled: true,
        url: 'https://example.org/about',
      },
      {
        id: 'community-events',
        sourceType: 'DB_COMMUNITY',
        kind: 'pinned_url',
        label: 'Community events',
        enabled: true,
        url: 'https://example.org/events/',
      },
    ]);

    const plan = await buildPipelineSourcePlan(regions, 'cli');

    expect(plan.dbPinnedCount).toBe(2);
    expect(plan.pinnedStrategies.map((strategy) => strategy.id)).toEqual([
      'community-events',
      'community-homepage',
    ]);
  });

  it('de-prioritizes stale event pages behind upcoming ones when pinned sources are capped', async () => {
    const { buildPipelineSourcePlan } = await import('../source-plan');

    process.env.PIPELINE_DB_PINNED_LIMIT = '3';
    mocks.findCities.mockResolvedValue([{ id: 'city-1', slug: 'stuttgart', name: 'Stuttgart' }]);
    mocks.groupCommunities.mockResolvedValue([{ cityId: 'city-1', _count: { _all: 6 } }]);
    mocks.getDbCommunityStrategies.mockResolvedValue([
      {
        id: 'community-past-events',
        sourceType: 'DB_COMMUNITY',
        kind: 'pinned_url',
        label: 'Community past events',
        enabled: true,
        url: 'https://example.org/past-events/',
      },
      {
        id: 'community-upcoming-events',
        sourceType: 'DB_COMMUNITY',
        kind: 'pinned_url',
        label: 'Community upcoming events',
        enabled: true,
        url: 'https://example.org/upcoming-events/',
      },
      {
        id: 'community-eventgallery',
        sourceType: 'DB_COMMUNITY',
        kind: 'pinned_url',
        label: 'Community event gallery',
        enabled: true,
        url: 'https://example.org/eventgallery',
      },
      {
        id: 'community-2025-schedule',
        sourceType: 'DB_COMMUNITY',
        kind: 'pinned_url',
        label: 'Community 2025 event schedule',
        enabled: true,
        url: 'https://example.org/2025-event-schedule/',
      },
    ]);

    const plan = await buildPipelineSourcePlan(regions, 'cli');

    expect(plan.pinnedStrategies.map((strategy) => strategy.id)).toEqual([
      'community-upcoming-events',
      'community-2025-schedule',
      'community-past-events',
    ]);
  });
});
