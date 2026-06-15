import { describe, expect, it } from 'vitest';
import {
  bucketHostEvents,
  computeHostCompleteness,
  getHostProfile,
  type HostEventRow,
} from '../host-workspace';

const now = new Date('2026-06-01T12:00:00Z');
const future = (days: number) => new Date(now.getTime() + days * 86_400_000);
const pastDate = (days: number) => new Date(now.getTime() - days * 86_400_000);

function evt(overrides: Partial<HostEventRow>): HostEventRow {
  return {
    id: Math.random().toString(36).slice(2),
    title: 'Event',
    slug: 'event',
    startsAt: future(5),
    status: 'UPCOMING',
    moderationState: 'PUBLISHED',
    reviewReason: null,
    isOnline: false,
    venueName: 'Venue',
    city: { name: 'Stuttgart', slug: 'stuttgart', timezone: 'Europe/Berlin' },
    ...overrides,
  };
}

describe('getHostProfile', () => {
  it('reads hostProfile metadata when present', () => {
    const profile = getHostProfile({
      displayName: 'Fallback',
      cityId: 'fallback-city',
      metadata: {
        hostProfile: { displayName: 'Priya', cityId: 'stuttgart', links: ['https://x'] },
      },
    });
    expect(profile).toEqual({ displayName: 'Priya', cityId: 'stuttgart', links: ['https://x'] });
  });

  it('falls back to user fields and empty links when metadata is missing', () => {
    const profile = getHostProfile({ displayName: 'Sam', cityId: 'berlin', metadata: null });
    expect(profile).toEqual({ displayName: 'Sam', cityId: 'berlin', links: [] });
  });

  it('drops non-string links defensively', () => {
    const profile = getHostProfile({
      displayName: null,
      cityId: null,
      metadata: { hostProfile: { links: ['ok', 42, null] } },
    });
    expect(profile.links).toEqual(['ok']);
  });
});

describe('computeHostCompleteness', () => {
  it('reports 0% for an empty profile and no events', () => {
    const c = computeHostCompleteness({ displayName: null, cityId: null, links: [] }, false);
    expect(c.doneCount).toBe(0);
    expect(c.pct).toBe(0);
  });

  it('reports 100% for a full profile with two links and an event', () => {
    const c = computeHostCompleteness(
      { displayName: 'Priya', cityId: 'stuttgart', links: ['https://a', 'https://b'] },
      true,
    );
    expect(c.doneCount).toBe(5);
    expect(c.pct).toBe(100);
  });

  it('counts a single link but not the second-link item', () => {
    const c = computeHostCompleteness(
      { displayName: 'Priya', cityId: 'stuttgart', links: ['https://a'] },
      false,
    );
    // name + city + one link = 3 of 5
    expect(c.doneCount).toBe(3);
    expect(c.pct).toBe(60);
  });
});

describe('bucketHostEvents', () => {
  it('buckets events into live / in-review / declined / past by the two axes', () => {
    const events: HostEventRow[] = [
      evt({ moderationState: 'PUBLISHED', startsAt: future(3) }), // live
      evt({ moderationState: 'PENDING_REVIEW', startsAt: future(4) }), // in review (counts to cap)
      evt({ moderationState: 'REJECTED', startsAt: future(2), reviewReason: 'Duplicate' }), // declined
      evt({ moderationState: 'PUBLISHED', startsAt: pastDate(3) }), // past
    ];
    const stats = bucketHostEvents(events, now);
    expect(stats.live).toBe(1);
    expect(stats.inReview).toBe(1);
    expect(stats.declined).toBe(1);
    expect(stats.past).toBe(1);
    expect(stats.unverifiedUpcomingCount).toBe(1);
    expect(stats.declinedEvents).toHaveLength(1);
    expect(stats.declinedEvents[0].reviewReason).toBe('Duplicate');
  });

  it('does not count a cancelled upcoming event as live or upcoming', () => {
    const stats = bucketHostEvents(
      [evt({ moderationState: 'PUBLISHED', status: 'CANCELLED', startsAt: future(3) })],
      now,
    );
    expect(stats.live).toBe(0);
    expect(stats.upcoming).toBe(0);
  });

  it('picks the nearest upcoming event as nextUpcoming', () => {
    const stats = bucketHostEvents(
      [evt({ slug: 'far', startsAt: future(10) }), evt({ slug: 'near', startsAt: future(2) })],
      now,
    );
    expect(stats.nextUpcoming?.slug).toBe('near');
  });

  it('returns null nextUpcoming when there are no upcoming events', () => {
    const stats = bucketHostEvents([evt({ startsAt: pastDate(1) })], now);
    expect(stats.nextUpcoming).toBeNull();
  });
});
