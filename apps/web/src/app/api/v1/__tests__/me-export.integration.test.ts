/**
 * Integration tests for GET /api/v1/me/export.
 *
 * Verifies authenticated portability export shape and core data coverage.
 * @db - requires test database
 */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { testDb, cleanDb } from '@/test/db-helpers';
import { bearerHeaders } from '@/test/auth-helpers';
import { createCity, createCommunity, createEvent, createResource } from '@/test/fixtures';

vi.mock('@/lib/db', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/db')>();
  const { testDb } = await import('@/test/db-helpers');
  return { ...mod, db: testDb };
});

import { GET } from '@/app/api/v1/me/export/route';

const USER_ID = 'user-me-export-test-01';

function makeGET(headers: Record<string, string>) {
  return new NextRequest('http://localhost/api/v1/me/export', {
    method: 'GET',
    headers,
  });
}

beforeEach(async () => {
  await cleanDb();

  const city = await createCity(testDb, { slug: 'export-city', name: 'Export City' });

  await testDb.user.create({
    data: {
      id: USER_ID,
      email: `${USER_ID}@example.test`,
      role: 'USER',
      cityId: city.id,
      displayName: 'Export User',
      onboardingComplete: true,
      personaSegments: ['newcomer'],
      preferredLanguages: ['en'],
    },
  });

  const createdCommunity = await createCommunity(testDb, {
    cityId: city.id,
    name: 'Created Community',
    slug: 'created-community',
    createdByUserId: USER_ID,
  });

  const createdEvent = await createEvent(testDb, {
    cityId: city.id,
    title: 'Created Event',
    slug: 'created-event',
    createdByUserId: USER_ID,
  });

  const savedCommunity = await createCommunity(testDb, {
    cityId: city.id,
    name: 'Saved Community',
    slug: 'saved-community',
  });

  const savedEvent = await createEvent(testDb, {
    cityId: city.id,
    title: 'Saved Event',
    slug: 'saved-event',
  });

  const savedResource = await createResource(testDb, {
    title: 'Saved Resource',
    slug: 'saved-resource',
    cityId: city.id,
  });

  await testDb.savedCommunity.create({
    data: { userId: USER_ID, communityId: savedCommunity.id },
  });
  await testDb.savedEvent.create({
    data: { userId: USER_ID, eventId: savedEvent.id },
  });
  await testDb.savedResource.create({
    data: { userId: USER_ID, resourceId: savedResource.id },
  });

  await testDb.contentReport.create({
    data: {
      reportType: 'OTHER',
      status: 'PENDING',
      details: 'Portable report details',
      reporterUserId: USER_ID,
      reporterEmail: `${USER_ID}@example.test`,
      communityId: createdCommunity.id,
    },
  });

  await testDb.notificationPreference.create({
    data: {
      userId: USER_ID,
      topic: 'WEEKLY_DIGEST',
      channel: 'EMAIL',
      enabled: true,
    },
  });

  // Noise from another user must not leak into export payload.
  const otherUserId = 'user-me-export-other-01';
  await testDb.user.create({
    data: { id: otherUserId, email: `${otherUserId}@example.test`, role: 'USER' },
  });
  await testDb.savedCommunity.create({
    data: { userId: otherUserId, communityId: createdCommunity.id },
  });

  expect(createdEvent.id).toBeTruthy();
});

afterAll(async () => {
  await testDb.$disconnect();
});

describe('GET /api/v1/me/export', () => {
  it('returns 401 without token', async () => {
    const res = await GET(makeGET({}));
    expect(res.status).toBe(401);
  });

  it('returns portability export payload for authenticated user', async () => {
    const headers = await bearerHeaders({ userId: USER_ID });
    const res = await GET(makeGET(headers));

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.exportedAt).toBeDefined();
    expect(body.user.id).toBe(USER_ID);
    expect(body.user.email).toBe(`${USER_ID}@example.test`);

    expect(body.createdCommunities).toHaveLength(1);
    expect(body.createdCommunities[0].community.slug).toBe('created-community');

    expect(body.createdEvents).toHaveLength(1);
    expect(body.createdEvents[0].event.slug).toBe('created-event');

    expect(body.savedCommunities).toHaveLength(1);
    expect(body.savedCommunities[0].community.slug).toBe('saved-community');

    expect(body.savedEvents).toHaveLength(1);
    expect(body.savedEvents[0].event.slug).toBe('saved-event');

    expect(body.savedResources).toHaveLength(1);
    expect(body.savedResources[0].resource.slug).toBe('saved-resource');

    expect(body.contentReports).toHaveLength(1);
    expect(body.contentReports[0].details).toBe('Portable report details');

    expect(body.notificationPreferences).toEqual([
      {
        topic: 'WEEKLY_DIGEST',
        channel: 'EMAIL',
        enabled: true,
      },
    ]);
  });
});
