import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ANALYTICS_EVENTS, buildTrackPayload } from './events';

describe('analytics/events', () => {
  it('builds a minimal payload from just an event name', () => {
    const payload = buildTrackPayload({ event: ANALYTICS_EVENTS.discoverFeedViewed });
    assert.deepEqual(payload, { event: 'discover.feed.viewed' });
  });

  it('includes optional entity + city fields when present', () => {
    const payload = buildTrackPayload({
      event: ANALYTICS_EVENTS.eventSaved,
      entityType: 'EVENT',
      entityId: 'evt_1',
      citySlug: 'stuttgart',
      metadata: { source: 'card' },
    });
    assert.deepEqual(payload, {
      event: 'event.saved',
      entityType: 'EVENT',
      entityId: 'evt_1',
      citySlug: 'stuttgart',
      metadata: { source: 'card' },
    });
  });

  it('drops empty optional fields', () => {
    const payload = buildTrackPayload({
      event: ANALYTICS_EVENTS.eventShared,
      entityId: '',
      citySlug: '',
      metadata: {},
    });
    assert.deepEqual(payload, { event: 'event.shared' });
  });
});
