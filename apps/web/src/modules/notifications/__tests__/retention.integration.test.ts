/**
 * Integration tests for retention producers (PRD/TDD-0049).
 *
 * @db - requires test database
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { testDb, cleanDb } from '@/test/db-helpers';
import { createCity, createCommunity, createEvent, createUser } from '@/test/fixtures';

vi.mock('@/lib/db', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/db')>();
  const { testDb } = await import('@/test/db-helpers');
  return { ...mod, db: testDb };
});

import {
  enqueueWeeklyDigest,
  enqueueSavedEventReminders,
  isoWeekStamp,
} from '@/modules/notifications';

const NOW = new Date('2026-06-03T10:00:00.000Z');

describe('enqueueWeeklyDigest @db', () => {
  beforeEach(async () => {
    await cleanDb();
  });

  afterAll(async () => {
    await cleanDb();
    await testDb.$disconnect();
  });

  it('enqueues a digest for users who saved a community in an active city', async () => {
    const city = await createCity(testDb, {
      slug: 'digest-city',
      name: 'DigestCity',
      isActive: true,
    });
    const community = await createCommunity(testDb, { cityId: city.id, slug: 'digest-comm' });
    await createEvent(testDb, {
      cityId: city.id,
      slug: 'digest-event',
      startsAt: new Date(NOW.getTime() + 2 * 86400000),
    });
    const user = await createUser(testDb, { email: 'digest-user@example.com' });
    await testDb.savedCommunity.create({ data: { userId: user.id, communityId: community.id } });

    const result = await enqueueWeeklyDigest(NOW);
    expect(result.enqueued).toBe(1);

    const rows = await testDb.notificationOutbox.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].topic).toBe('WEEKLY_DIGEST');
    expect(rows[0].idempotencyKey).toBe(`WEEKLY_DIGEST:${city.id}:${user.id}:${isoWeekStamp(NOW)}`);
  });

  it('is idempotent across re-runs in the same ISO week', async () => {
    const city = await createCity(testDb, {
      slug: 'digest-city2',
      name: 'DigestCity2',
      isActive: true,
    });
    const community = await createCommunity(testDb, { cityId: city.id, slug: 'digest-comm2' });
    await createEvent(testDb, {
      cityId: city.id,
      slug: 'digest-event2',
      startsAt: new Date(NOW.getTime() + 2 * 86400000),
    });
    const user = await createUser(testDb, { email: 'digest-user2@example.com' });
    await testDb.savedCommunity.create({ data: { userId: user.id, communityId: community.id } });

    await enqueueWeeklyDigest(NOW);
    await enqueueWeeklyDigest(NOW);

    const rows = await testDb.notificationOutbox.findMany();
    expect(rows).toHaveLength(1);
  });

  it('skips cities with no upcoming events', async () => {
    const city = await createCity(testDb, {
      slug: 'digest-empty',
      name: 'DigestEmpty',
      isActive: true,
    });
    const community = await createCommunity(testDb, { cityId: city.id, slug: 'digest-empty-comm' });
    const user = await createUser(testDb, { email: 'digest-empty-user@example.com' });
    await testDb.savedCommunity.create({ data: { userId: user.id, communityId: community.id } });

    const result = await enqueueWeeklyDigest(NOW);
    expect(result.enqueued).toBe(0);
  });
});

describe('enqueueSavedEventReminders @db', () => {
  beforeEach(async () => {
    await cleanDb();
  });

  afterAll(async () => {
    await cleanDb();
    await testDb.$disconnect();
  });

  it('enqueues a reminder for events starting in 24-48h that a user saved', async () => {
    const city = await createCity(testDb, { slug: 'rem-city', name: 'RemCity', isActive: true });
    const event = await createEvent(testDb, {
      cityId: city.id,
      slug: 'rem-event',
      startsAt: new Date(NOW.getTime() + 30 * 3600000),
    });
    const user = await createUser(testDb, { email: 'rem-user@example.com' });
    await testDb.savedEvent.create({ data: { userId: user.id, eventId: event.id } });

    const result = await enqueueSavedEventReminders(NOW);
    expect(result.enqueued).toBe(1);

    const rows = await testDb.notificationOutbox.findMany();
    expect(rows[0].topic).toBe('SAVED_EVENT_REMINDER');
    expect(rows[0].idempotencyKey).toBe(`SAVED_EVENT_REMINDER:${event.id}:${user.id}`);
  });

  it('ignores events outside the 24-48h window', async () => {
    const city = await createCity(testDb, { slug: 'rem-city2', name: 'RemCity2', isActive: true });
    const event = await createEvent(testDb, {
      cityId: city.id,
      slug: 'rem-event2',
      startsAt: new Date(NOW.getTime() + 5 * 3600000),
    });
    const user = await createUser(testDb, { email: 'rem-user2@example.com' });
    await testDb.savedEvent.create({ data: { userId: user.id, eventId: event.id } });

    const result = await enqueueSavedEventReminders(NOW);
    expect(result.enqueued).toBe(0);
  });

  it('is idempotent across re-runs', async () => {
    const city = await createCity(testDb, { slug: 'rem-city3', name: 'RemCity3', isActive: true });
    const event = await createEvent(testDb, {
      cityId: city.id,
      slug: 'rem-event3',
      startsAt: new Date(NOW.getTime() + 30 * 3600000),
    });
    const user = await createUser(testDb, { email: 'rem-user3@example.com' });
    await testDb.savedEvent.create({ data: { userId: user.id, eventId: event.id } });

    await enqueueSavedEventReminders(NOW);
    await enqueueSavedEventReminders(NOW);

    const rows = await testDb.notificationOutbox.findMany();
    expect(rows).toHaveLength(1);
  });
});
