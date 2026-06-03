/**
 * Integration tests - event governance / moderation axis (ADR-0009 / TDD-0037).
 *
 * @db - requires test database.
 * Prerequisites: `./dev.sh test:setup`
 *
 * Verifies the moderation invariants:
 *  - the host lane creates PENDING_REVIEW events attributed to the creator;
 *  - public reads only surface PUBLISHED events;
 *  - admin approve/reject transition PENDING_REVIEW and record the reviewer.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { testDb, cleanDb } from '@/test/db-helpers';
import { createCity, createCommunity, createEvent, createUser } from '@/test/fixtures';

vi.mock('@/lib/db', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/db')>();
  const { testDb } = await import('@/test/db-helpers');
  // resolveCityIds closes over the original db; rebuild it against testDb.
  async function resolveCityIds(citySlug: string): Promise<string[]> {
    const city = await testDb.city.findUnique({ where: { slug: citySlug }, select: { id: true } });
    return city ? [city.id] : [];
  }
  return { ...mod, db: testDb, resolveCityIds };
});

type SessionUser = {
  id: string;
  role: string;
  claimedCommunities?: Array<{
    id: string;
    claimedByUserId: string | null;
    city: { id: string; slug: string; name?: string };
  }>;
};
let currentSession: SessionUser | null = null;
let currentCommunityId: string | null = null;

vi.mock('@/lib/session', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/session')>();
  return {
    ...mod,
    getSessionUser: async () => currentSession,
    getCurrentCommunityId: async () => currentCommunityId,
  };
});

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock('@/lib/analytics/server', () => ({ captureServerEvent: vi.fn() }));
vi.mock('@/lib/email', () => ({
  sendHostEventApprovedEmail: vi.fn(),
  sendHostEventRejectedEmail: vi.fn(),
}));
// Surface the redirect throw so we can assert DB state after the host action.
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    const err = new Error(`NEXT_REDIRECT:${url}`);
    (err as Error & { digest?: string }).digest = `NEXT_REDIRECT;replace;${url};307;`;
    throw err;
  },
}));

import { approveEvent, rejectEvent } from '../actions';
import { addEvent } from '@/app/organizer/(community)/events/new/actions';
import { addHostEvent } from '@/app/organizer/host/events/new/actions';

async function createCategory() {
  return testDb.category.create({
    data: {
      name: 'Professional',
      slug: 'professional',
      type: 'CATEGORY',
      sortOrder: 1,
    },
  });
}

beforeEach(async () => {
  await cleanDb();
  currentSession = null;
  currentCommunityId = null;
});

afterAll(async () => {
  await testDb.$disconnect();
});

describe('@db host lane', () => {
  it('creates a PENDING_REVIEW event attributed to the host', async () => {
    const city = await createCity(testDb);
    const category = await createCategory();
    const host = await createUser(testDb, { email: 'host@example.com', role: 'EVENT_HOST' });
    currentSession = { id: host.id, role: 'EVENT_HOST' };

    const form = new FormData();
    form.set('title', 'Host Meetup');
    form.set('cityId', city.id);
    form.append('categorySlugs', category.slug);
    form.set('startsAt', '2026-06-15T18:30');
    form.set('endsAt', '2026-06-15T20:30');
    form.set('cost', 'free');
    form.set('isOnline', 'true');
    form.set('onlineLink', 'https://meet.example.com/host-meetup');

    await expect(addHostEvent(null, form)).rejects.toThrow(
      /NEXT_REDIRECT:\/organizer\/host\/events/,
    );

    const event = await testDb.event.findFirst({ where: { createdByUserId: host.id } });
    expect(event?.moderationState).toBe('PENDING_REVIEW');
    expect(event?.createdByUserId).toBe(host.id);

    const eventCategory = await testDb.eventCategory.findFirst({ where: { eventId: event?.id } });
    expect(eventCategory?.categoryId).toBeTruthy();
  });

  it('enforces the unverified cap counting PENDING_REVIEW events', async () => {
    const city = await createCity(testDb);
    const category = await createCategory();
    const host = await createUser(testDb, { email: 'host@example.com', role: 'EVENT_HOST' });
    currentSession = { id: host.id, role: 'EVENT_HOST' };

    for (let i = 0; i < 5; i++) {
      await createEvent(testDb, {
        cityId: city.id,
        slug: `pending-${i}`,
        createdByUserId: host.id,
        moderationState: 'PENDING_REVIEW',
        startsAt: new Date(Date.now() + 86_400_000),
      });
    }

    const form = new FormData();
    form.set('title', 'One Too Many');
    form.set('cityId', city.id);
    form.append('categorySlugs', category.slug);
    form.set('startsAt', '2026-06-15T18:30');
    form.set('endsAt', '2026-06-15T20:30');
    form.set('cost', 'free');
    form.set('isOnline', 'true');
    form.set('onlineLink', 'https://meet.example.com/cap-test');

    const result = await addHostEvent(null, form);
    expect(result).toMatchObject({ success: false });
  });

  it('rejects online host events without online link', async () => {
    const city = await createCity(testDb);
    const category = await createCategory();
    const host = await createUser(testDb, { email: 'host@example.com', role: 'EVENT_HOST' });
    currentSession = { id: host.id, role: 'EVENT_HOST' };

    const form = new FormData();
    form.set('title', 'Host Meetup Missing Link');
    form.set('cityId', city.id);
    form.append('categorySlugs', category.slug);
    form.set('startsAt', '2026-06-15T18:30');
    form.set('endsAt', '2026-06-15T20:30');
    form.set('cost', 'free');
    form.set('isOnline', 'true');

    const result = await addHostEvent(null, form);
    expect(result).toMatchObject({ success: false });
    expect(result && 'errors' in result ? result.errors.onlineLink?.[0] : undefined).toBe(
      'Online events require an online link.',
    );
  });
});

describe('@db community lane', () => {
  it('creates a published community event and requires endsAt', async () => {
    const city = await createCity(testDb);
    const category = await createCategory();
    const community = await createCommunity(testDb, { cityId: city.id });
    const organizer = await createUser(testDb, { email: 'organizer@example.com', role: 'USER' });
    currentSession = {
      id: organizer.id,
      role: 'USER',
      claimedCommunities: [
        {
          id: community.id,
          claimedByUserId: organizer.id,
          city: { id: city.id, slug: city.slug, name: city.name },
        },
      ],
    };
    currentCommunityId = community.id;

    const validForm = new FormData();
    validForm.set('title', 'Community Meetup');
    validForm.append('categorySlugs', category.slug);
    validForm.set('startsAt', '2026-06-15T18:30');
    validForm.set('endsAt', '2026-06-15T20:30');
    validForm.set('venueName', 'Community Hall');
    validForm.set('venueAddress', 'Street 1, Stuttgart');
    validForm.set('recurrencePreset', 'weekly');
    validForm.set('cost', 'free');

    await expect(addEvent(null, validForm)).rejects.toThrow(/NEXT_REDIRECT:\/organizer\/events/);

    const created = await testDb.event.findFirst({ where: { communityId: community.id } });
    expect(created?.moderationState).toBe('PUBLISHED');
    expect(created?.createdByUserId).toBe(organizer.id);
    expect(created?.isRecurring).toBe(true);
    expect(created?.recurrenceRule).toBe('FREQ=WEEKLY');

    const createdCategories = await testDb.eventCategory.findMany({
      where: { eventId: created?.id },
    });
    expect(createdCategories.length).toBe(1);

    const invalidForm = new FormData();
    invalidForm.set('title', 'Missing End Time');
    invalidForm.append('categorySlugs', category.slug);
    invalidForm.set('startsAt', '2026-06-15T18:30');
    invalidForm.set('venueName', 'Community Hall');
    invalidForm.set('venueAddress', 'Street 1, Stuttgart');
    invalidForm.set('cost', 'free');

    const result = await addEvent(null, invalidForm);
    expect(result).toMatchObject({ success: false });
    expect(result && 'errors' in result ? result.errors.endsAt?.[0] : undefined).toBe(
      'End date is required',
    );
  });

  it('rejects offline community events without venue details', async () => {
    const city = await createCity(testDb);
    const category = await createCategory();
    const community = await createCommunity(testDb, { cityId: city.id });
    const organizer = await createUser(testDb, { email: 'organizer@example.com', role: 'USER' });
    currentSession = {
      id: organizer.id,
      role: 'USER',
      claimedCommunities: [
        {
          id: community.id,
          claimedByUserId: organizer.id,
          city: { id: city.id, slug: city.slug, name: city.name },
        },
      ],
    };
    currentCommunityId = community.id;

    const form = new FormData();
    form.set('title', 'Offline Missing Venue');
    form.append('categorySlugs', category.slug);
    form.set('startsAt', '2026-06-15T18:30');
    form.set('endsAt', '2026-06-15T20:30');
    form.set('cost', 'free');

    const result = await addEvent(null, form);
    expect(result).toMatchObject({ success: false });
    expect(result && 'errors' in result ? result.errors.venueName?.[0] : undefined).toBe(
      'Venue name is required for offline events.',
    );
    expect(result && 'errors' in result ? result.errors.venueAddress?.[0] : undefined).toBe(
      'Venue address is required for offline events.',
    );
  });
});

describe('@db approveEvent / rejectEvent', () => {
  async function seedPendingHostEvent() {
    const city = await createCity(testDb);
    const host = await createUser(testDb, { email: 'host@example.com', role: 'EVENT_HOST' });
    const admin = await createUser(testDb, {
      email: 'admin@example.com',
      role: 'PLATFORM_ADMIN',
    });
    const event = await createEvent(testDb, {
      cityId: city.id,
      slug: 'pending-event',
      createdByUserId: host.id,
      moderationState: 'PENDING_REVIEW',
    });
    return { city, host, admin, event };
  }

  it('approve transitions PENDING_REVIEW -> PUBLISHED and records the reviewer', async () => {
    const { admin, event } = await seedPendingHostEvent();
    currentSession = { id: admin.id, role: 'PLATFORM_ADMIN' };

    const form = new FormData();
    form.set('id', event.id);
    await approveEvent(form);

    const updated = await testDb.event.findUnique({ where: { id: event.id } });
    expect(updated?.moderationState).toBe('PUBLISHED');
    expect(updated?.reviewedById).toBe(admin.id);
    expect(updated?.reviewedAt).not.toBeNull();

    const log = await testDb.contentLog.findFirst({
      where: { entityType: 'event', entityId: event.id },
    });
    expect(log?.action).toBe('UPDATED');
  });

  it('reject transitions PENDING_REVIEW -> REJECTED and stores the reason', async () => {
    const { admin, event } = await seedPendingHostEvent();
    currentSession = { id: admin.id, role: 'PLATFORM_ADMIN' };

    const form = new FormData();
    form.set('id', event.id);
    form.set('reason', 'Spam');
    await rejectEvent(form);

    const updated = await testDb.event.findUnique({ where: { id: event.id } });
    expect(updated?.moderationState).toBe('REJECTED');
    expect(updated?.reviewReason).toBe('Spam');
    expect(updated?.reviewedById).toBe(admin.id);
  });

  it('approve is a no-op for an already-published event', async () => {
    const city = await createCity(testDb);
    const admin = await createUser(testDb, {
      email: 'admin@example.com',
      role: 'PLATFORM_ADMIN',
    });
    const event = await createEvent(testDb, {
      cityId: city.id,
      slug: 'live-event',
      moderationState: 'PUBLISHED',
    });
    currentSession = { id: admin.id, role: 'PLATFORM_ADMIN' };

    const form = new FormData();
    form.set('id', event.id);
    await approveEvent(form);

    const updated = await testDb.event.findUnique({ where: { id: event.id } });
    expect(updated?.reviewedById).toBeNull();
  });
});

describe('@db public read gating', () => {
  it('hides non-PUBLISHED events from getEventBySlug / getUpcomingEvents', async () => {
    const city = await createCity(testDb);
    await createCommunity(testDb, { cityId: city.id });

    await createEvent(testDb, {
      cityId: city.id,
      slug: 'visible-event',
      moderationState: 'PUBLISHED',
    });
    await createEvent(testDb, {
      cityId: city.id,
      slug: 'hidden-pending',
      moderationState: 'PENDING_REVIEW',
    });
    await createEvent(testDb, {
      cityId: city.id,
      slug: 'hidden-rejected',
      moderationState: 'REJECTED',
    });

    const { getEventBySlug, getUpcomingEvents } = await import('@/modules/event/queries');

    expect(await getEventBySlug('visible-event')).not.toBeNull();
    expect(await getEventBySlug('hidden-pending')).toBeNull();
    expect(await getEventBySlug('hidden-rejected')).toBeNull();

    const upcoming = await getUpcomingEvents(city.slug);
    const slugs = upcoming.map((e) => e.slug);
    expect(slugs).toContain('visible-event');
    expect(slugs).not.toContain('hidden-pending');
    expect(slugs).not.toContain('hidden-rejected');
  });
});
