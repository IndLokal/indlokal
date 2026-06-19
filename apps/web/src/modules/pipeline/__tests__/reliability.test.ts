import { describe, expect, it } from 'vitest';
import {
  applySourceConfidenceAdjustment,
  buildSourceReliabilityKey,
  buildSourceReliabilityStatsFromRows,
} from '../reliability';

describe('buildSourceReliabilityStatsFromRows', () => {
  it('keeps separate stats per source and lane', () => {
    const stats = buildSourceReliabilityStatsFromRows([
      {
        sourceType: 'WEBSITE_SCRAPE',
        entityType: 'EVENT',
        status: 'APPROVED',
        _count: { _all: 8 },
      },
      {
        sourceType: 'WEBSITE_SCRAPE',
        entityType: 'EVENT',
        status: 'REJECTED',
        _count: { _all: 2 },
      },
      {
        sourceType: 'WEBSITE_SCRAPE',
        entityType: 'COMMUNITY',
        status: 'APPROVED',
        _count: { _all: 1 },
      },
      {
        sourceType: 'WEBSITE_SCRAPE',
        entityType: 'COMMUNITY',
        status: 'REJECTED',
        _count: { _all: 4 },
      },
    ]);

    expect(stats).toHaveLength(2);

    const eventStat = stats.find((stat) => stat.lane === 'EVENT');
    const communityStat = stats.find((stat) => stat.lane === 'COMMUNITY');

    expect(eventStat).toMatchObject({
      key: 'WEBSITE_SCRAPE:EVENT',
      sourceType: 'WEBSITE_SCRAPE',
      lane: 'EVENT',
      approved: 8,
      rejected: 2,
      totalReviewed: 10,
      approvalRate: 0.8,
      confidenceAdjustment: 0.05,
    });
    expect(communityStat).toMatchObject({
      key: 'WEBSITE_SCRAPE:COMMUNITY',
      sourceType: 'WEBSITE_SCRAPE',
      lane: 'COMMUNITY',
      approved: 1,
      rejected: 4,
      totalReviewed: 5,
      approvalRate: 0.2,
      confidenceAdjustment: -0.05,
    });
  });
});

describe('buildSourceReliabilityKey', () => {
  it('builds a stable composite key', () => {
    expect(buildSourceReliabilityKey('GOOGLE_SEARCH', 'RESOURCE')).toBe('GOOGLE_SEARCH:RESOURCE');
  });
});

describe('applySourceConfidenceAdjustment', () => {
  it('keeps confidence within 0..1 bounds', () => {
    expect(applySourceConfidenceAdjustment(0.98, 0.05)).toBe(1);
    expect(applySourceConfidenceAdjustment(0.02, -0.05)).toBe(0);
  });
});
