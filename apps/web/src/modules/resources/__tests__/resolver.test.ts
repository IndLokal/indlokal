/**
 * Resolver unit tests - PRD/TDD-0030 §6.
 *
 * Mocks `@/lib/db` so it runs without a database. Verifies:
 *  - scope OR clause is built per city characteristics (metro, state)
 *  - consular jurisdiction filter is applied for COUNTRY rows
 *  - dedup-by-slug picks the most specific scope tier
 *  - cache hit / invalidation
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const findUniqueMock = vi.fn();
const findManyMock = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    city: { findUnique: (...args: unknown[]) => findUniqueMock(...args) },
    resource: { findMany: (...args: unknown[]) => findManyMock(...args) },
  },
}));

import { getResourcesForCity, invalidateResolver, consulateForState } from '../resolver';

beforeEach(() => {
  findUniqueMock.mockReset();
  findManyMock.mockReset();
  invalidateResolver();
});

afterEach(() => {
  invalidateResolver();
});

const makeRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'cid_' + Math.random().toString(36).slice(2, 10),
  title: 'A row',
  slug: 'a-row',
  resourceType: 'CITY_REGISTRATION',
  url: null,
  description: null,
  validFrom: null,
  validUntil: null,
  metadata: null,
  createdAt: new Date(0),
  source: 'ADMIN_SEED',
  lastReviewedAt: new Date('2026-01-01T00:00:00.000Z'),
  reviewCadenceDays: 180,
  isHidden: false,
  hiddenReason: null,
  scope: 'COUNTRY',
  scopeRegion: 'DE',
  audiences: [],
  lifecycleStage: [],
  priority: 50,
  isEssential: false,
  ...overrides,
});

describe('consulateForState', () => {
  it('maps Berlin to embassy', () => {
    expect(consulateForState('DE-BE')).toBe('berlin');
  });
  it('maps Baden-Württemberg to Munich', () => {
    expect(consulateForState('DE-BW')).toBe('munich');
  });
  it('maps NRW to Frankfurt', () => {
    expect(consulateForState('DE-NW')).toBe('frankfurt');
  });
  it('returns null for unknown', () => {
    expect(consulateForState(null)).toBeNull();
    expect(consulateForState('XX')).toBeNull();
  });
});

describe('getResourcesForCity - scope OR clause', () => {
  it('returns [] for unknown city without calling resource.findMany', async () => {
    findUniqueMock.mockResolvedValueOnce(null);
    const rows = await getResourcesForCity('does-not-exist');
    expect(rows).toEqual([]);
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it('includes GLOBAL, COUNTRY, STATE, METRO, CITY scopes for a metro city', async () => {
    findUniqueMock.mockResolvedValueOnce({
      id: 'city_stuttgart',
      slug: 'stuttgart',
      state: 'DE-BW',
      isMetroPrimary: true,
      metroRegion: null,
    });
    findManyMock.mockResolvedValueOnce([]);
    await getResourcesForCity('stuttgart');
    const where = findManyMock.mock.calls[0][0].where;
    const orClause = where.AND[0].OR as Array<Record<string, unknown>>;
    const scopes = orClause.flatMap((c) => {
      if (typeof c.scope === 'string') return [c.scope];
      const inner = (c.AND as Array<Record<string, unknown>>)?.[0];
      return inner?.scope ? [inner.scope as string] : [];
    });
    expect(scopes).toEqual(expect.arrayContaining(['GLOBAL', 'COUNTRY', 'STATE', 'METRO', 'CITY']));
  });

  it('uses metroRegion.slug for METRO scope on a satellite city', async () => {
    findUniqueMock.mockResolvedValueOnce({
      id: 'city_heidelberg',
      slug: 'heidelberg',
      state: 'DE-BW',
      isMetroPrimary: false,
      metroRegion: { slug: 'mannheim' },
    });
    findManyMock.mockResolvedValueOnce([]);
    await getResourcesForCity('heidelberg');
    const where = findManyMock.mock.calls[0][0].where;
    const orClause = where.AND[0].OR as Array<Record<string, unknown>>;
    const metro = orClause.find((c) => c.scope === 'METRO');
    expect(metro).toEqual({ scope: 'METRO', scopeRegion: 'mannheim' });
  });
});

describe('getResourcesForCity - dedup by slug picks most specific scope', () => {
  it('keeps the CITY row when COUNTRY and CITY both match', async () => {
    findUniqueMock.mockResolvedValueOnce({
      id: 'city_berlin',
      slug: 'berlin',
      state: 'DE-BE',
      isMetroPrimary: true,
      metroRegion: null,
    });
    findManyMock.mockResolvedValueOnce([
      makeRow({ slug: 'same-thing', title: 'COUNTRY version', scope: 'COUNTRY' }),
      makeRow({
        slug: 'same-thing',
        title: 'CITY version',
        scope: 'CITY',
        scopeRegion: 'berlin',
      }),
    ]);
    const rows = await getResourcesForCity('berlin');
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe('CITY version');
    expect(rows[0].resolvedScope).toBe('CITY');
    expect(rows[0].trust.sourceLabel).toBe('Official Source');
    expect(rows[0].trust.trustBand).toBe('SOURCE_SUPPORTED');
  });
});

describe('getResourcesForCity - trust projection', () => {
  it('prefers metadata trust override when present', async () => {
    findUniqueMock.mockResolvedValueOnce({
      id: 'city_stuttgart',
      slug: 'stuttgart',
      state: 'DE-BW',
      isMetroPrimary: true,
      metroRegion: null,
    });
    findManyMock.mockResolvedValueOnce([
      makeRow({
        slug: 'trust-override',
        scope: 'CITY',
        source: 'USER_SUGGESTED',
        metadata: {
          trust: {
            band: 'STRONG_SOURCE',
            verificationMethod: 'Manual compliance check',
          },
        },
      }),
    ]);

    const rows = await getResourcesForCity('stuttgart');
    expect(rows).toHaveLength(1);
    expect(rows[0].trust.trustBand).toBe('STRONG_SOURCE');
    expect(rows[0].trust.verificationMethod).toBe('Manual compliance check');
    expect(rows[0].trust.lastVerifiedAtDisplay).toBeTruthy();
  });
});

describe('getResourcesForCity - freshness lifecycle', () => {
  it('demotes stale resources behind fresh ones with same base priority', async () => {
    findUniqueMock.mockResolvedValueOnce({
      id: 'city_stuttgart',
      slug: 'stuttgart',
      state: 'DE-BW',
      isMetroPrimary: true,
      metroRegion: null,
    });
    findManyMock.mockResolvedValueOnce([
      makeRow({
        slug: 'stale-row',
        title: 'Stale Row',
        scope: 'CITY',
        priority: 80,
        lastReviewedAt: new Date('2024-01-01T00:00:00.000Z'),
        reviewCadenceDays: 30,
      }),
      makeRow({
        slug: 'fresh-row',
        title: 'Fresh Row',
        scope: 'CITY',
        priority: 80,
        lastReviewedAt: new Date('2099-01-01T00:00:00.000Z'),
        reviewCadenceDays: 30,
      }),
    ]);

    const rows = await getResourcesForCity('stuttgart');
    expect(rows).toHaveLength(2);
    expect(rows[0].slug).toBe('fresh-row');
    expect(rows[0].freshness.state).toBe('IN_TTL');
    expect(rows[1].freshness.state).not.toBe('IN_TTL');
  });

  it('hides prolonged stale rows when explicit auto-hide guardrail is enabled', async () => {
    findUniqueMock.mockResolvedValueOnce({
      id: 'city_stuttgart',
      slug: 'stuttgart',
      state: 'DE-BW',
      isMetroPrimary: true,
      metroRegion: null,
    });
    findManyMock.mockResolvedValueOnce([
      makeRow({
        slug: 'auto-hidden',
        title: 'Auto Hidden',
        scope: 'CITY',
        isEssential: false,
        lifecycleStage: ['SETTLED'],
        lastReviewedAt: new Date('2023-01-01T00:00:00.000Z'),
        reviewCadenceDays: 30,
        metadata: { freshness: { allowAutoHide: true } },
      }),
      makeRow({
        slug: 'retained',
        title: 'Retained',
        scope: 'CITY',
        lastReviewedAt: new Date('2099-01-01T00:00:00.000Z'),
      }),
    ]);

    const rows = await getResourcesForCity('stuttgart');
    expect(rows).toHaveLength(1);
    expect(rows[0].slug).toBe('retained');
  });
});

describe('getResourcesForCity - cache', () => {
  it('does not re-query Prisma on a repeated call', async () => {
    findUniqueMock.mockResolvedValue({
      id: 'city_stuttgart',
      slug: 'stuttgart',
      state: 'DE-BW',
      isMetroPrimary: true,
      metroRegion: null,
    });
    findManyMock.mockResolvedValue([]);
    await getResourcesForCity('stuttgart');
    await getResourcesForCity('stuttgart');
    expect(findManyMock).toHaveBeenCalledTimes(1);
  });

  it('re-queries after invalidate', async () => {
    findUniqueMock.mockResolvedValue({
      id: 'city_stuttgart',
      slug: 'stuttgart',
      state: 'DE-BW',
      isMetroPrimary: true,
      metroRegion: null,
    });
    findManyMock.mockResolvedValue([]);
    await getResourcesForCity('stuttgart');
    invalidateResolver();
    await getResourcesForCity('stuttgart');
    expect(findManyMock).toHaveBeenCalledTimes(2);
  });
});
