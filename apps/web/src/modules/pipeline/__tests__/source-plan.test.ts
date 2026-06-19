import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SearchRegion } from '../types';
import type { KeywordStrategyTemplate } from '../runtime-config';

const mocks = vi.hoisted(() => ({
  findCities: vi.fn(),
  groupCommunities: vi.fn(),
  groupEvents: vi.fn(),
  getRuntimeKeywordSeeds: vi.fn(),
  getRuntimeKeywordStrategies: vi.fn(),
  getRuntimePinnedStrategies: vi.fn(),
  getRuntimeLaneKeywordSeeds: vi.fn(),
  getDbCommunityStrategies: vi.fn(),
  getApprovedDynamicKeywords: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    city: { findMany: mocks.findCities },
    community: { groupBy: mocks.groupCommunities },
    event: { groupBy: mocks.groupEvents },
  },
}));

vi.mock('../runtime-config', () => ({
  getRuntimeKeywordSeeds: mocks.getRuntimeKeywordSeeds,
  getRuntimeKeywordStrategies: mocks.getRuntimeKeywordStrategies,
  getRuntimePinnedStrategies: mocks.getRuntimePinnedStrategies,
  getRuntimeLaneKeywordSeeds: mocks.getRuntimeLaneKeywordSeeds,
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

const keywordStrategies: KeywordStrategyTemplate[] = [
  {
    id: 'eventbrite-keyword',
    sourceType: 'EVENTBRITE',
    kind: 'keyword_search',
    label: 'Eventbrite',
    enabled: true,
    radiusKm: 50,
  },
  {
    id: 'google-cse-keyword',
    sourceType: 'GOOGLE_SEARCH',
    kind: 'keyword_search',
    label: 'Google',
    enabled: true,
    radiusKm: 100,
  },
  {
    id: 'duckduckgo-keyword',
    sourceType: 'DUCKDUCKGO',
    kind: 'keyword_search',
    label: 'DuckDuckGo',
    enabled: true,
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

    mocks.getRuntimeKeywordSeeds.mockResolvedValue(['Indian community meetup']);
    mocks.getRuntimeLaneKeywordSeeds.mockResolvedValue({
      byLane: {
        EVENT: ['festival', 'conference'],
        COMMUNITY: ['association', 'club'],
        RESOURCE: ['service', 'support'],
      },
      journeyResourceByStage: {
        SEEKING: ['help center'],
        DECIDING: ['comparison'],
        SETTLED: ['maintenance'],
        ANYTIME: ['general info'],
      },
    });
    mocks.getRuntimeKeywordStrategies.mockResolvedValue(keywordStrategies);
    mocks.getRuntimePinnedStrategies.mockResolvedValue([]);
    mocks.getDbCommunityStrategies.mockResolvedValue([]);
    mocks.getApprovedDynamicKeywords.mockResolvedValue([]);
    mocks.groupEvents.mockResolvedValue([]);
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
    mocks.groupEvents.mockResolvedValue([
      { cityId: 'city-1', _count: { _all: 3 } },
      { cityId: 'city-2', _count: { _all: 3 } },
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
    mocks.groupCommunities.mockResolvedValue([
      { cityId: 'city-1', _count: { _all: 6 } },
      { cityId: 'city-2', _count: { _all: 4 } },
    ]);
    mocks.groupEvents.mockResolvedValue([{ cityId: 'city-1', _count: { _all: 3 } }]);

    const plan = await buildPipelineSourcePlan(regions, 'cli');

    const allGapCities = [...plan.eventGaps, ...plan.communityGaps];
    expect(allGapCities).toEqual([
      {
        slug: 'karlsruhe',
        name: 'Karlsruhe',
        communityCount: 4,
        upcomingEventCount: 0,
      },
    ]);
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
    mocks.groupEvents.mockResolvedValue([{ cityId: 'city-1', _count: { _all: 3 } }]);

    const plan = await buildPipelineSourcePlan(regions, 'cli');

    expect(plan.keywordStrategies).toEqual([]);
    expect(plan.notes).toContain(
      'skipping duckduckgo-keyword: disabled by default; set PIPELINE_ENABLE_DDG=1 to enable',
    );
  });

  it('uses explicit lane intent when selecting gap keywords', async () => {
    const { buildPipelineSourcePlan } = await import('../source-plan');

    process.env.EVENTBRITE_API_KEY = 'test-key';
    process.env.GOOGLE_CSE_API_KEY = 'test-key';
    process.env.GOOGLE_CSE_ID = 'test-cse';
    process.env.PIPELINE_ENABLE_DDG = '1';
    mocks.getRuntimeKeywordStrategies.mockResolvedValue([
      {
        id: 'eventbrite-keyword',
        sourceType: 'EVENTBRITE',
        kind: 'keyword_search',
        label: 'Eventbrite',
        enabled: true,
        radiusKm: 50,
        lane: 'EVENT',
      },
      {
        id: 'google-community-keyword',
        sourceType: 'GOOGLE_SEARCH',
        kind: 'keyword_search',
        label: 'Google Community',
        enabled: true,
        radiusKm: 100,
        lane: 'COMMUNITY',
      },
      {
        id: 'duckduckgo-keyword',
        sourceType: 'DUCKDUCKGO',
        kind: 'keyword_search',
        label: 'DuckDuckGo',
        enabled: true,
        radiusKm: 100,
      },
    ]);
    mocks.findCities.mockResolvedValue([
      { id: 'city-1', slug: 'stuttgart', name: 'Stuttgart' },
      { id: 'city-2', slug: 'karlsruhe', name: 'Karlsruhe' },
    ]);
    mocks.groupCommunities.mockResolvedValue([
      { cityId: 'city-1', _count: { _all: 6 } },
      { cityId: 'city-2', _count: { _all: 4 } },
    ]);
    mocks.groupEvents.mockResolvedValue([{ cityId: 'city-1', _count: { _all: 3 } }]);

    const plan = await buildPipelineSourcePlan(regions, 'cli');

    const eventbrite = plan.keywordStrategies.find(
      (strategy) => strategy.id === 'eventbrite-keyword',
    );
    const communityGoogle = plan.keywordStrategies.find(
      (strategy) => strategy.id === 'google-community-keyword',
    );
    const duckduckgo = plan.keywordStrategies.find(
      (strategy) => strategy.id === 'duckduckgo-keyword',
    );

    expect(eventbrite?.keywords).toContain('Indian event Karlsruhe');
    expect(eventbrite?.keywords).not.toContain('Indian community group Karlsruhe');
    expect(communityGoogle?.keywords.join(' ')).toContain('Indian community group Karlsruhe');
    expect(communityGoogle?.keywords.join(' ')).not.toContain('Indian event Karlsruhe');
    expect(duckduckgo?.keywords).toContain('Indian event Karlsruhe');
    expect(duckduckgo?.keywords).toContain('Indian community group Karlsruhe');
  });

  it('returns additive lane breakdown metadata for the built plan', async () => {
    const { buildPipelineSourcePlan } = await import('../source-plan');

    process.env.EVENTBRITE_API_KEY = 'test-key';
    process.env.PIPELINE_ENABLE_DDG = '1';
    mocks.getRuntimeKeywordStrategies.mockResolvedValue([
      {
        id: 'eventbrite-keyword',
        sourceType: 'EVENTBRITE',
        kind: 'keyword_search',
        label: 'Eventbrite',
        enabled: true,
        radiusKm: 50,
        lane: 'EVENT',
      },
      {
        id: 'duckduckgo-keyword',
        sourceType: 'DUCKDUCKGO',
        kind: 'keyword_search',
        label: 'DuckDuckGo',
        enabled: true,
        radiusKm: 100,
      },
    ]);
    mocks.getRuntimePinnedStrategies.mockResolvedValue([
      {
        id: 'community-directory',
        sourceType: 'WEBSITE_SCRAPE',
        kind: 'pinned_url',
        label: 'Community directory',
        enabled: true,
        url: 'https://example.org/community-directory',
        lane: 'COMMUNITY',
      },
    ]);
    mocks.findCities.mockResolvedValue([
      { id: 'city-1', slug: 'stuttgart', name: 'Stuttgart' },
      { id: 'city-2', slug: 'karlsruhe', name: 'Karlsruhe' },
    ]);
    mocks.groupCommunities.mockResolvedValue([
      { cityId: 'city-1', _count: { _all: 6 } },
      { cityId: 'city-2', _count: { _all: 4 } },
    ]);
    mocks.groupEvents.mockResolvedValue([{ cityId: 'city-1', _count: { _all: 3 } }]);

    const plan = await buildPipelineSourcePlan(regions, 'cli');

    expect(plan.laneBreakdown.EVENT.keywordStrategies).toBe(1);
    expect(plan.laneBreakdown.COMMUNITY.pinnedStrategies).toBe(1);
    expect(plan.laneBreakdown.UNKNOWN.keywordStrategies).toBe(1);
    expect(plan.notes).toContain(
      'lane distribution: COMMUNITY:k0/p1 EVENT:k1/p0 RESOURCE:k0/p0 UNKNOWN:k1/p0',
    );
  });

  it('prioritizes DB event pages when pinned sources are capped', async () => {
    const { buildPipelineSourcePlan } = await import('../source-plan');

    process.env.PIPELINE_DB_PINNED_LIMIT = '2';
    mocks.findCities.mockResolvedValue([{ id: 'city-1', slug: 'stuttgart', name: 'Stuttgart' }]);
    mocks.groupCommunities.mockResolvedValue([{ cityId: 'city-1', _count: { _all: 6 } }]);
    mocks.groupEvents.mockResolvedValue([{ cityId: 'city-1', _count: { _all: 3 } }]);
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
    mocks.groupEvents.mockResolvedValue([{ cityId: 'city-1', _count: { _all: 3 } }]);
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

  it('spreads capped DB pinned sources across cities instead of letting one city dominate', async () => {
    const { buildPipelineSourcePlan } = await import('../source-plan');

    process.env.PIPELINE_DB_PINNED_LIMIT = '3';
    mocks.findCities.mockResolvedValue([
      { id: 'city-1', slug: 'stuttgart', name: 'Stuttgart' },
      { id: 'city-2', slug: 'frankfurt', name: 'Frankfurt' },
    ]);
    mocks.groupCommunities.mockResolvedValue([
      { cityId: 'city-1', _count: { _all: 6 } },
      { cityId: 'city-2', _count: { _all: 6 } },
    ]);
    mocks.groupEvents.mockResolvedValue([
      { cityId: 'city-1', _count: { _all: 3 } },
      { cityId: 'city-2', _count: { _all: 3 } },
    ]);
    mocks.getDbCommunityStrategies.mockResolvedValue([
      {
        id: 'stuttgart-events',
        sourceType: 'DB_COMMUNITY',
        kind: 'pinned_url',
        label: 'Stuttgart events',
        enabled: true,
        hintCitySlug: 'stuttgart',
        url: 'https://stuttgart.example.org/events',
      },
      {
        id: 'stuttgart-homepage',
        sourceType: 'DB_COMMUNITY',
        kind: 'pinned_url',
        label: 'Stuttgart homepage',
        enabled: true,
        hintCitySlug: 'stuttgart',
        url: 'https://stuttgart.example.org/',
      },
      {
        id: 'stuttgart-about',
        sourceType: 'DB_COMMUNITY',
        kind: 'pinned_url',
        label: 'Stuttgart about',
        enabled: true,
        hintCitySlug: 'stuttgart',
        url: 'https://stuttgart.example.org/about',
      },
      {
        id: 'frankfurt-events',
        sourceType: 'DB_COMMUNITY',
        kind: 'pinned_url',
        label: 'Frankfurt events',
        enabled: true,
        hintCitySlug: 'frankfurt',
        url: 'https://frankfurt.example.org/events',
      },
    ]);

    const plan = await buildPipelineSourcePlan(regions, 'cli');

    expect(plan.pinnedStrategies.map((strategy) => strategy.id)).toEqual([
      'stuttgart-events',
      'frankfurt-events',
      'stuttgart-homepage',
    ]);
  });

  it('spreads capped DB pinned sources across communities within the same city', async () => {
    const { buildPipelineSourcePlan } = await import('../source-plan');

    process.env.PIPELINE_DB_PINNED_LIMIT = '2';
    mocks.findCities.mockResolvedValue([{ id: 'city-1', slug: 'stuttgart', name: 'Stuttgart' }]);
    mocks.groupCommunities.mockResolvedValue([{ cityId: 'city-1', _count: { _all: 6 } }]);
    mocks.groupEvents.mockResolvedValue([{ cityId: 'city-1', _count: { _all: 3 } }]);
    mocks.getDbCommunityStrategies.mockResolvedValue([
      {
        id: 'db-jito-stuttgart-website-events',
        sourceType: 'DB_COMMUNITY',
        kind: 'pinned_url',
        label: 'JITO Stuttgart events',
        enabled: true,
        hintCitySlug: 'stuttgart',
        url: 'https://jitostuttgart.de/events/',
      },
      {
        id: 'db-jito-stuttgart-website',
        sourceType: 'DB_COMMUNITY',
        kind: 'pinned_url',
        label: 'JITO Stuttgart homepage',
        enabled: true,
        hintCitySlug: 'stuttgart',
        url: 'https://jitostuttgart.de/',
      },
      {
        id: 'db-tamil-sangam-stuttgart-website-events',
        sourceType: 'DB_COMMUNITY',
        kind: 'pinned_url',
        label: 'Tamil Sangam Stuttgart events',
        enabled: true,
        hintCitySlug: 'stuttgart',
        url: 'https://tamil.example.org/events/',
      },
    ]);

    const plan = await buildPipelineSourcePlan(regions, 'cli');

    expect(plan.pinnedStrategies.map((strategy) => strategy.id)).toEqual([
      'db-jito-stuttgart-website-events',
      'db-tamil-sangam-stuttgart-website-events',
    ]);
  });

  it('prefers future event detail pages over generic event listings for the same community', async () => {
    const { buildPipelineSourcePlan } = await import('../source-plan');

    process.env.PIPELINE_DB_PINNED_LIMIT = '1';
    mocks.findCities.mockResolvedValue([{ id: 'city-1', slug: 'stuttgart', name: 'Stuttgart' }]);
    mocks.groupCommunities.mockResolvedValue([{ cityId: 'city-1', _count: { _all: 6 } }]);
    mocks.groupEvents.mockResolvedValue([{ cityId: 'city-1', _count: { _all: 3 } }]);
    mocks.getDbCommunityStrategies.mockResolvedValue([
      {
        id: 'db-jito-stuttgart-website-events',
        sourceType: 'DB_COMMUNITY',
        kind: 'pinned_url',
        label: 'JITO Stuttgart (/events/)',
        enabled: true,
        hintCitySlug: 'stuttgart',
        url: 'https://jitostuttgart.de/events/',
      },
      {
        id: 'db-jito-stuttgart-website-jito-stuttgart-summit-2026',
        sourceType: 'DB_COMMUNITY',
        kind: 'pinned_url',
        label: 'JITO Stuttgart (/jito-stuttgart-summit-2026/)',
        enabled: true,
        hintCitySlug: 'stuttgart',
        url: 'https://jitostuttgart.de/jito-stuttgart-summit-2026/',
      },
    ]);

    const plan = await buildPipelineSourcePlan(regions, 'cli');

    expect(plan.pinnedStrategies.map((strategy) => strategy.id)).toEqual([
      'db-jito-stuttgart-website-jito-stuttgart-summit-2026',
    ]);
  });

  it('caps DB pinned sources for admin-triggered runs like cron', async () => {
    const { buildPipelineSourcePlan } = await import('../source-plan');

    mocks.findCities.mockResolvedValue([{ id: 'city-1', slug: 'stuttgart', name: 'Stuttgart' }]);
    mocks.groupCommunities.mockResolvedValue([{ cityId: 'city-1', _count: { _all: 6 } }]);
    mocks.groupEvents.mockResolvedValue([{ cityId: 'city-1', _count: { _all: 3 } }]);
    mocks.getDbCommunityStrategies.mockResolvedValue(
      Array.from({ length: 55 }, (_, index) => ({
        id: `db-community-${index}`,
        sourceType: 'DB_COMMUNITY' as const,
        kind: 'pinned_url' as const,
        label: `DB Community ${index}`,
        enabled: true,
        hintCitySlug: 'stuttgart',
        url: `https://example.org/community-${index}/events`,
      })),
    );

    const adminPlan = await buildPipelineSourcePlan(regions, 'admin');
    const cliPlan = await buildPipelineSourcePlan(regions, 'cli');

    expect(adminPlan.dbPinnedCount).toBe(40);
    expect(cliPlan.dbPinnedCount).toBe(55);
  });

  it('excludes explicit RESOURCE lane strategies from normal cron plans only', async () => {
    const { buildPipelineSourcePlan } = await import('../source-plan');

    process.env.EVENTBRITE_API_KEY = 'test-key';
    process.env.GOOGLE_CSE_API_KEY = 'test-key';
    process.env.GOOGLE_CSE_ID = 'test-cse';
    process.env.PIPELINE_FORCE_KEYWORD_SEARCH = '1';
    mocks.findCities.mockResolvedValue([{ id: 'city-1', slug: 'stuttgart', name: 'Stuttgart' }]);
    mocks.groupCommunities.mockResolvedValue([{ cityId: 'city-1', _count: { _all: 1 } }]);
    mocks.groupEvents.mockResolvedValue([]);
    mocks.getRuntimePinnedStrategies.mockResolvedValue([
      {
        id: 'resource-portal',
        sourceType: 'WEBSITE_SCRAPE',
        kind: 'pinned_url',
        label: 'Resource portal',
        enabled: true,
        url: 'https://example.org/resource',
        lane: 'RESOURCE',
      },
      {
        id: 'community-directory',
        sourceType: 'WEBSITE_SCRAPE',
        kind: 'pinned_url',
        label: 'Community directory',
        enabled: true,
        url: 'https://example.org/community',
        lane: 'COMMUNITY',
      },
    ]);
    mocks.getRuntimeKeywordStrategies.mockResolvedValue([
      {
        id: 'eventbrite-keyword',
        sourceType: 'EVENTBRITE',
        kind: 'keyword_search',
        label: 'Eventbrite',
        enabled: true,
        radiusKm: 50,
        lane: 'EVENT',
      },
      {
        id: 'resource-keyword',
        sourceType: 'GOOGLE_SEARCH',
        kind: 'keyword_search',
        label: 'Resource keyword',
        enabled: true,
        radiusKm: 100,
        lane: 'RESOURCE',
      },
    ]);

    const cronPlan = await buildPipelineSourcePlan(regions, 'cron');
    const adminPlan = await buildPipelineSourcePlan(regions, 'admin');

    expect(cronPlan.pinnedStrategies.map((strategy) => strategy.id)).toEqual([
      // explicit COMMUNITY lane discovery is also excluded in event-first cron
    ]);
    expect(cronPlan.pinnedStrategies.map((strategy) => strategy.id)).toEqual([]);
    expect(cronPlan.keywordStrategies.map((strategy) => strategy.id)).toEqual([
      'eventbrite-keyword',
    ]);
    expect(cronPlan.notes).toContain(
      'cron run: skipped 1 RESOURCE pinned strategies (admin/city scoped only)',
    );
    expect(cronPlan.notes).toContain(
      'cron run: skipped 1 COMMUNITY pinned strategies (event-first cron)',
    );
    expect(cronPlan.notes).toContain(
      'cron run: skipped 1 RESOURCE keyword strategies (admin/city scoped only)',
    );

    expect(adminPlan.pinnedStrategies.map((strategy) => strategy.id)).toEqual([
      'resource-portal',
      'community-directory',
    ]);
    expect(adminPlan.keywordStrategies.map((strategy) => strategy.id)).toEqual([
      'eventbrite-keyword',
      'resource-keyword',
    ]);
  });

  it('excludes explicit COMMUNITY lane keyword strategies from cron but keeps them for admin', async () => {
    const { buildPipelineSourcePlan } = await import('../source-plan');

    process.env.GOOGLE_CSE_API_KEY = 'test-key';
    process.env.GOOGLE_CSE_ID = 'test-cse';
    process.env.PIPELINE_FORCE_KEYWORD_SEARCH = '1';
    mocks.findCities.mockResolvedValue([{ id: 'city-1', slug: 'stuttgart', name: 'Stuttgart' }]);
    mocks.groupCommunities.mockResolvedValue([{ cityId: 'city-1', _count: { _all: 1 } }]);
    mocks.groupEvents.mockResolvedValue([]);
    mocks.getRuntimeKeywordStrategies.mockResolvedValue([
      {
        id: 'google-community-keyword',
        sourceType: 'GOOGLE_SEARCH',
        kind: 'keyword_search',
        label: 'Google Community',
        enabled: true,
        radiusKm: 100,
        lane: 'COMMUNITY',
      },
    ]);

    const cronPlan = await buildPipelineSourcePlan(regions, 'cron');
    const adminPlan = await buildPipelineSourcePlan(regions, 'admin');

    expect(cronPlan.keywordStrategies).toEqual([]);
    expect(cronPlan.notes).toContain(
      'cron run: skipped 1 COMMUNITY keyword strategies (event-first cron)',
    );

    expect(adminPlan.keywordStrategies.map((strategy) => strategy.id)).toEqual([
      'google-community-keyword',
    ]);
  });

  it('prioritizes event-starved metro cities ahead of empty satellites in the gap list', async () => {
    const { buildPipelineSourcePlan } = await import('../source-plan');

    const broaderRegions: SearchRegion[] = [
      {
        id: 'mixed',
        label: 'Mixed',
        searchCenter: 'Germany',
        citySlugs: ['stuttgart', 'munich', 'frankfurt', 'bad-homburg'],
        enabled: true,
      },
    ];

    mocks.findCities.mockResolvedValue([
      { id: 'city-1', slug: 'stuttgart', name: 'Stuttgart', isMetroPrimary: true },
      { id: 'city-2', slug: 'munich', name: 'Munich', isMetroPrimary: true },
      { id: 'city-3', slug: 'frankfurt', name: 'Frankfurt', isMetroPrimary: true },
      { id: 'city-4', slug: 'bad-homburg', name: 'Bad Homburg', isMetroPrimary: false },
    ]);
    mocks.groupCommunities.mockResolvedValue([
      { cityId: 'city-1', _count: { _all: 6 } },
      { cityId: 'city-2', _count: { _all: 5 } },
      { cityId: 'city-3', _count: { _all: 9 } },
    ]);
    mocks.groupEvents.mockResolvedValue([{ cityId: 'city-1', _count: { _all: 3 } }]);

    const plan = await buildPipelineSourcePlan(broaderRegions, 'cron');

    const allGapCitiesForPriority = [...plan.eventGaps, ...plan.communityGaps];
    expect(allGapCitiesForPriority.slice(0, 3).map((city) => city.slug)).toEqual([
      'frankfurt',
      'munich',
      'bad-homburg',
    ]);
  });
});
