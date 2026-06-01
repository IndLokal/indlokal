import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  THIS_WEEK_DAYS,
  FALLBACK_DAYS,
  thisWeekWindow,
  fallbackWindow,
  buildEventsQuery,
  eventsFeedPath,
  bucketForEvent,
} from './this-week';

const NOW = new Date('2026-01-07T12:00:00.000Z'); // a Wednesday

describe('discovery/this-week windows', () => {
  it('computes a 7-day window from now', () => {
    const w = thisWeekWindow(NOW);
    assert.equal(w.days, THIS_WEEK_DAYS);
    assert.equal(w.fromIso, NOW.toISOString());
    assert.equal(w.toIso, new Date('2026-01-14T12:00:00.000Z').toISOString());
  });

  it('computes a 30-day fallback window', () => {
    const w = fallbackWindow(NOW);
    assert.equal(w.days, FALLBACK_DAYS);
    assert.equal(w.toIso, new Date('2026-02-06T12:00:00.000Z').toISOString());
  });
});

describe('discovery/this-week query building', () => {
  it('builds an events query string', () => {
    const qs = buildEventsQuery(thisWeekWindow(NOW), 50);
    const params = new URLSearchParams(qs);
    assert.equal(params.get('from'), NOW.toISOString());
    assert.equal(params.get('limit'), '50');
  });

  it('builds the full feed path with an encoded city slug', () => {
    const path = eventsFeedPath('münchen', thisWeekWindow(NOW));
    assert.ok(path.startsWith('/api/v1/discovery/m%C3%BCnchen/events?'));
  });
});

describe('discovery/this-week bucketing', () => {
  it('buckets today and past as today', () => {
    assert.equal(bucketForEvent({ startsAt: '2026-01-07T20:00:00.000Z' }, NOW), 'today');
    assert.equal(bucketForEvent({ startsAt: '2026-01-06T20:00:00.000Z' }, NOW), 'today');
  });

  it('buckets an upcoming saturday as weekend', () => {
    // 2026-01-10 is a Saturday, 3 days out.
    assert.equal(bucketForEvent({ startsAt: '2026-01-10T18:00:00.000Z' }, NOW), 'weekend');
  });

  it('buckets a weekday further out as later', () => {
    assert.equal(bucketForEvent({ startsAt: '2026-01-13T18:00:00.000Z' }, NOW), 'later');
  });
});
