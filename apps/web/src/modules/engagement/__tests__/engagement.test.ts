import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDb, mockEnqueueNotification, mockCaptureServerEvent } = vi.hoisted(() => ({
  mockDb: {
    community: { findUnique: vi.fn() },
    event: { findUnique: vi.fn() },
    savedCommunity: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    savedEvent: { upsert: vi.fn(), deleteMany: vi.fn(), findUnique: vi.fn() },
    userInteraction: { create: vi.fn() },
    notificationOutbox: { updateMany: vi.fn() },
  },
  mockEnqueueNotification: vi.fn(),
  mockCaptureServerEvent: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ db: mockDb }));
vi.mock('@/modules/notifications', () => ({ enqueueNotification: mockEnqueueNotification }));
vi.mock('@/lib/analytics/server', () => ({ captureServerEvent: mockCaptureServerEvent }));

import { followCommunityForUser, saveEventForUser, unsaveEventForUser } from '../index';

describe('engagement helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.community.findUnique.mockResolvedValue({
      id: 'community-1',
      name: 'Kannada Stuttgart',
      slug: 'kannada-stuttgart',
      cityId: 'city-1',
      city: { slug: 'stuttgart' },
    });
    mockDb.event.findUnique.mockResolvedValue({
      id: 'event-1',
      title: 'Holi Stuttgart',
      slug: 'holi-stuttgart',
      startsAt: new Date('2026-06-10T18:00:00.000Z'),
      cityId: 'city-1',
      city: { slug: 'stuttgart' },
      communityId: 'community-1',
      community: { id: 'community-1', name: 'Kannada Stuttgart', slug: 'kannada-stuttgart' },
    });
    mockDb.notificationOutbox.updateMany.mockResolvedValue({ count: 0 });
  });

  it('follows a community and records follow semantics', async () => {
    await followCommunityForUser('user-1', 'community-1');

    expect(mockDb.savedCommunity.upsert).toHaveBeenCalledWith({
      where: { userId_communityId: { userId: 'user-1', communityId: 'community-1' } },
      create: { userId: 'user-1', communityId: 'community-1' },
      update: {},
    });
    expect(mockDb.userInteraction.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        entityType: 'COMMUNITY',
        entityId: 'community-1',
        interactionType: 'SAVE',
        cityId: 'city-1',
        metadata: { semantic: 'FOLLOW' },
      },
    });
  });

  it('saving an upcoming event schedules future reminder windows', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-08T17:00:00.000Z'));

    const result = await saveEventForUser('user-1', 'event-1');

    expect(result).toEqual({ saved: true, remindersScheduled: 2 });
    expect(mockDb.savedEvent.upsert).toHaveBeenCalled();
    expect(mockEnqueueNotification).toHaveBeenCalledTimes(2);
    expect(mockEnqueueNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: 'SAVED_EVENT_REMINDER',
        channel: 'PUSH',
        idempotencyKey: 'user:user-1:event:event-1:reminder:T-24h',
      }),
    );

    vi.useRealTimers();
  });

  it('unsaving suppresses pending reminders', async () => {
    mockDb.notificationOutbox.updateMany.mockResolvedValue({ count: 2 });

    const result = await unsaveEventForUser('user-1', 'event-1');

    expect(result).toEqual({ saved: false, remindersSuppressed: 2 });
    expect(mockDb.savedEvent.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', eventId: 'event-1' },
    });
    expect(mockDb.notificationOutbox.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        topic: 'SAVED_EVENT_REMINDER',
        status: 'PENDING',
        idempotencyKey: { startsWith: 'user:user-1:event:event-1:reminder:' },
      },
      data: { status: 'SUPPRESSED' },
    });
  });

  it('re-saving reactivates previously suppressed reminders', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-08T17:00:00.000Z'));
    mockDb.notificationOutbox.updateMany.mockResolvedValue({ count: 1 });

    const result = await saveEventForUser('user-1', 'event-1');

    expect(result).toEqual({ saved: true, remindersScheduled: 2 });
    expect(mockDb.notificationOutbox.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
          topic: 'SAVED_EVENT_REMINDER',
          status: 'SUPPRESSED',
          idempotencyKey: 'user:user-1:event:event-1:reminder:T-24h',
        }),
        data: expect.objectContaining({
          status: 'PENDING',
        }),
      }),
    );
    expect(mockEnqueueNotification).not.toHaveBeenCalled();

    vi.useRealTimers();
  });
});
