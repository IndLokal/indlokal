import { describe, expect, it, vi, beforeEach } from 'vitest';

const dbMock = { $queryRaw: vi.fn() };

vi.mock('@/lib/db', () => ({ db: dbMock }));

beforeEach(() => {
  vi.resetModules();
  dbMock.$queryRaw.mockReset();
});

describe('runtime-config JSON fallback', () => {
  it('falls back to bundled defaults when DB query throws', async () => {
    dbMock.$queryRaw.mockRejectedValue(new Error('relation does not exist'));

    const mod = await import('../config/runtime-config');
    mod.resetRuntimeConfigCache();

    const regions = await mod.getRuntimeEnabledRegions();
    const laneSeeds = await mod.getRuntimeLaneKeywordSeeds();
    const keyword = await mod.getRuntimeKeywordStrategies();
    const pinned = await mod.getRuntimePinnedStrategies();
    const source = await mod.getRuntimeConfigSource();

    expect(source).toBe('json-fallback');
    expect(regions.length).toBeGreaterThan(0);
    expect(regions[0].citySlugs.length).toBeGreaterThan(0);
    expect((laneSeeds.byLane.EVENT ?? []).length).toBeGreaterThan(0);
    expect(keyword.some((k) => k.sourceType === 'EVENTBRITE')).toBe(true);
    expect(pinned.length).toBeGreaterThan(0);
    // DB was queried exactly once across all four getters (shared cache).
    expect(dbMock.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('falls back when DB returns zero rows', async () => {
    dbMock.$queryRaw.mockResolvedValue([]);

    const mod = await import('../config/runtime-config');
    mod.resetRuntimeConfigCache();

    const regions = await mod.getRuntimeEnabledRegions();
    const source = await mod.getRuntimeConfigSource();

    expect(source).toBe('json-fallback');
    expect(regions.length).toBeGreaterThan(0);
    expect(dbMock.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('serves DB rows when present', async () => {
    dbMock.$queryRaw.mockResolvedValue([
      {
        configType: 'REGION',
        key: 'test-region',
        label: 'Test Region',
        enabled: true,
        sourceType: null,
        kind: null,
        payload: { searchCenter: 'Berlin, Germany', citySlugs: ['berlin'] },
      },
      {
        configType: 'STRATEGY',
        key: 'eventbrite-keyword',
        label: 'Eventbrite',
        enabled: true,
        sourceType: 'EVENTBRITE',
        kind: 'keyword_search',
        payload: { radiusKm: 50, lane: 'EVENT', contentScope: 'community_events' },
      },
      {
        configType: 'STRATEGY',
        key: 'web-test',
        label: 'Test pinned',
        enabled: true,
        sourceType: 'WEBSITE_SCRAPE',
        kind: 'pinned_url',
        payload: {
          url: 'https://www.cgimunich.gov.in/',
          lane: 'RESOURCE',
          contentScope: 'official_portal',
        },
      },
    ]);

    const mod = await import('../config/runtime-config');
    mod.resetRuntimeConfigCache();

    const regions = await mod.getRuntimeEnabledRegions();
    const laneSeeds = await mod.getRuntimeLaneKeywordSeeds();
    const keywordStrategies = await mod.getRuntimeKeywordStrategies();
    const pinnedStrategies = await mod.getRuntimePinnedStrategies();
    const source = await mod.getRuntimeConfigSource();

    expect(source).toBe('db');
    expect(regions).toHaveLength(1);
    expect(regions[0].id).toBe('test-region');
    expect(laneSeeds.byLane.COMMUNITY).toBeDefined();
    expect(keywordStrategies[0]?.lane).toBe('EVENT');
    expect(keywordStrategies[0]?.sourceIntent).toBe('dated_activity_discovery');
    expect(pinnedStrategies[0]?.lane).toBe('RESOURCE');
    expect(pinnedStrategies[0]?.sourceIntent).toBe('official_service_info_discovery');
  });
});
