/**
 * Integration tests for POST /api/v1/reports.
 *
 * Key invariant: when an authenticated user submits a content report,
 * the `reporterUserId` field must be persisted to the database.
 *
 * @db - requires test database
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { testDb, cleanDb } from '@/test/db-helpers';
import { bearerHeaders } from '@/test/auth-helpers';
import { createCity, createEvent } from '@/test/fixtures';

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock('@/lib/db', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/db')>();
  const { testDb } = await import('@/test/db-helpers');
  return { ...mod, db: testDb };
});

vi.mock('@/lib/email', () => ({
  sendReportNotificationEmail: vi.fn(async () => undefined),
}));

import { POST } from '@/app/api/v1/reports/route';

// ─── Setup ─────────────────────────────────────────────────────────────────

const USER_ID = 'user-reports-test-01';

let citySlug: string;
let cityId: string;
let headers: Record<string, string>;

function makeReq(body: unknown, hdrs: Record<string, string>) {
  return new NextRequest('http://localhost/api/v1/reports', {
    method: 'POST',
    headers: hdrs,
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  await cleanDb();
  const city = await createCity(testDb, { slug: 'reports-city', name: 'ReportsCity' });
  citySlug = city.slug;
  cityId = city.id;
  // Create the user row so FK from content_reports.reporter_user_id → users.id resolves
  await testDb.user.upsert({
    where: { id: USER_ID },
    update: {},
    create: { id: USER_ID, email: `${USER_ID}@example.test`, role: 'USER' },
  });
  headers = await bearerHeaders({ userId: USER_ID });
});

afterAll(async () => {
  await testDb.$disconnect();
});

// ─── POST /api/v1/reports ──────────────────────────────────────────────────

describe('POST /api/v1/reports', () => {
  it('returns 401 without token', async () => {
    const res = await POST(makeReq({ reportType: 'INAPPROPRIATE_CONTENT' }, {}));
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing reportType', async () => {
    const res = await POST(makeReq({}, headers));
    expect(res.status).toBe(400);
  });

  it('creates a report and sets reporterUserId', async () => {
    const res = await POST(
      makeReq(
        {
          reportType: 'OTHER',
          details: 'This community promotes spam.',
          citySlug,
        },
        headers,
      ),
    );

    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body).toMatchObject({ reportType: 'OTHER', status: 'PENDING' });

    // The core invariant: reporterUserId must be persisted from the JWT subject
    const record = await testDb.contentReport.findUniqueOrThrow({
      where: { id: body.id },
      select: { reporterUserId: true },
    });
    expect(record.reporterUserId).toBe(USER_ID);
  });

  it('returns 401 without auth token (second check)', async () => {
    const res = await POST(makeReq({ reportType: 'STALE_INFO' }, {}));
    expect(res.status).toBe(401);
  });

  it('persists eventId for an event report', async () => {
    const event = await createEvent(testDb, { cityId });
    const res = await POST(
      makeReq(
        {
          reportType: 'INCORRECT_DETAILS',
          eventId: event.id,
          details: 'The start time is wrong.',
        },
        headers,
      ),
    );
    expect(res.status).toBe(201);

    const body = await res.json();
    const record = await testDb.contentReport.findUniqueOrThrow({
      where: { id: body.id },
      select: { eventId: true, reporterUserId: true },
    });
    expect(record.eventId).toBe(event.id);
    expect(record.reporterUserId).toBe(USER_ID);
  });

  it('returns 404 for a non-existent eventId', async () => {
    const res = await POST(
      makeReq({ reportType: 'STALE_INFO', eventId: 'clnonexistent000000000000' }, headers),
    );
    expect(res.status).toBe(404);
  });
});
