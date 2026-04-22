/**
 * Integration tests for TDD-0009 submit API endpoints.
 *
 * Covers:
 *   POST /api/v1/uploads/presign        — presigned URL (S3 mocked)
 *   POST /api/v1/submissions/event      — event pipeline item
 *   POST /api/v1/submissions/community  — community pipeline item + dedup
 *   POST /api/v1/submissions/suggest    — community suggestion pipeline item
 *
 * @db — requires test database
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { testDb, cleanDb } from '@/test/db-helpers';
import { bearerHeaders } from '@/test/auth-helpers';
import { createCity, createCommunity } from '@/test/fixtures';

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock('@/lib/db', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/db')>();
  const { testDb } = await import('@/test/db-helpers');
  return { ...mod, db: testDb };
});

// Mock S3 presigning so tests don't need real AWS credentials
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi
    .fn()
    .mockResolvedValue('https://s3.example.com/presigned-put?X-Amz-Signature=abc'),
}));

vi.mock('@/lib/storage', () => ({
  getS3Client: vi.fn().mockReturnValue({}),
  UPLOAD_BUCKET: 'test-bucket',
  UPLOAD_PUBLIC_URL_BASE: 'https://cdn.example.com',
  UPLOAD_PRESIGN_TTL_SECONDS: 300,
}));

import { POST as presignPOST } from '@/app/api/v1/uploads/presign/route';
import { POST as eventPOST } from '@/app/api/v1/submissions/event/route';
import { POST as communityPOST } from '@/app/api/v1/submissions/community/route';
import { POST as suggestPOST } from '@/app/api/v1/submissions/suggest/route';

// ─── Setup ─────────────────────────────────────────────────────────────────

const USER_ID = 'user-submit-test-01';

let citySlug: string;
let cityId: string;
let headers: Record<string, string>;

function makeReq(path: string, body: unknown, hdrs: Record<string, string>) {
  return new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    headers: hdrs,
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  await cleanDb();
  const city = await createCity(testDb, { slug: 'submit-city', name: 'SubmitCity' });
  citySlug = city.slug;
  cityId = city.id;
  headers = await bearerHeaders({ userId: USER_ID });
});

afterAll(async () => {
  await testDb.$disconnect();
});

// ─── POST /api/v1/uploads/presign ──────────────────────────────────────────

describe('POST /api/v1/uploads/presign', () => {
  it('returns 401 without token', async () => {
    const res = await presignPOST(makeReq('/api/v1/uploads/presign', {}, {}));
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid content-type', async () => {
    const res = await presignPOST(
      makeReq(
        '/api/v1/uploads/presign',
        { contentType: 'application/pdf', sizeBytes: 1000, sha256: 'a'.repeat(64) },
        headers,
      ),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 for file too large', async () => {
    const res = await presignPOST(
      makeReq(
        '/api/v1/uploads/presign',
        { contentType: 'image/jpeg', sizeBytes: 20 * 1024 * 1024, sha256: 'a'.repeat(64) },
        headers,
      ),
    );
    expect(res.status).toBe(400);
  });

  it('returns presigned URL on valid request', async () => {
    const res = await presignPOST(
      makeReq(
        '/api/v1/uploads/presign',
        { contentType: 'image/jpeg', sizeBytes: 500_000, sha256: 'a'.repeat(64) },
        headers,
      ),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.url).toContain('presigned-put');
    expect(body.key).toMatch(/^uploads\//);
    expect(body.expiresAt).toBeDefined();
    // Verify MediaAsset row was created
    const asset = await testDb.mediaAsset.findFirst({ where: { createdBy: USER_ID } });
    expect(asset).not.toBeNull();
    expect(asset?.sha256).toBe('a'.repeat(64));
  });
});

// ─── POST /api/v1/submissions/event ────────────────────────────────────────

describe('POST /api/v1/submissions/event', () => {
  it('returns 401 without token', async () => {
    const res = await eventPOST(makeReq('/api/v1/submissions/event', {}, {}));
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing required fields', async () => {
    const res = await eventPOST(makeReq('/api/v1/submissions/event', { title: '' }, headers));
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown citySlug', async () => {
    const res = await eventPOST(
      makeReq(
        '/api/v1/submissions/event',
        {
          title: 'Holi Night',
          citySlug: 'nonexistent-city',
          startsAt: new Date(Date.now() + 86400000).toISOString(),
        },
        headers,
      ),
    );
    expect(res.status).toBe(404);
  });

  it('creates a pipeline item and returns 201', async () => {
    const startsAt = new Date(Date.now() + 86400000).toISOString();
    const res = await eventPOST(
      makeReq(
        '/api/v1/submissions/event',
        {
          title: 'Diwali Mela 2026',
          description: 'Big annual Diwali celebration',
          citySlug,
          startsAt,
          isOnline: false,
          contactEmail: 'organizer@example.com',
          contactName: 'Test Organizer',
        },
        headers,
      ),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.entityType).toBe('EVENT');
    expect(body.status).toBe('PENDING');
    expect(body.id).toBeDefined();

    const item = await testDb.pipelineItem.findUnique({ where: { id: body.id } });
    expect(item?.submittedBy).toBe(USER_ID);
    expect(item?.sourceType).toBe('USER_SUBMITTED');
  });

  it('stores imageKey on the pipeline item', async () => {
    const startsAt = new Date(Date.now() + 86400000).toISOString();
    const res = await eventPOST(
      makeReq(
        '/api/v1/submissions/event',
        {
          title: 'Navratri Garba',
          citySlug,
          startsAt,
          imageKey: 'uploads/user-submit-test-01/img.jpg',
        },
        headers,
      ),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    const item = await testDb.pipelineItem.findUnique({ where: { id: body.id } });
    expect(item?.imageKey).toBe('uploads/user-submit-test-01/img.jpg');
  });
});

// ─── POST /api/v1/submissions/community ────────────────────────────────────

describe('POST /api/v1/submissions/community', () => {
  const validPayload = () => ({
    name: 'Stuttgart Tamil Sangam',
    description: 'A community for Tamil speakers in Stuttgart',
    citySlug,
    categories: ['cultural'],
    languages: ['Tamil', 'English'],
    primaryChannelType: 'WHATSAPP',
    primaryChannelUrl: 'https://chat.whatsapp.com/abc123',
    contactEmail: 'organizer@example.com',
    contactName: 'Test User',
  });

  it('returns 401 without token', async () => {
    const res = await communityPOST(makeReq('/api/v1/submissions/community', {}, {}));
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing required fields', async () => {
    const res = await communityPOST(
      makeReq('/api/v1/submissions/community', { name: 'AB' }, headers),
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown citySlug', async () => {
    const res = await communityPOST(
      makeReq(
        '/api/v1/submissions/community',
        { ...validPayload(), citySlug: 'ghost-city' },
        headers,
      ),
    );
    expect(res.status).toBe(404);
  });

  it('creates a pipeline item and returns 201', async () => {
    const res = await communityPOST(
      makeReq('/api/v1/submissions/community', validPayload(), headers),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.entityType).toBe('COMMUNITY');
    expect(body.status).toBe('PENDING');

    const item = await testDb.pipelineItem.findUnique({ where: { id: body.id } });
    expect(item?.submittedBy).toBe(USER_ID);
    expect(item?.sourceType).toBe('USER_SUBMITTED');
    expect(item?.cityId).toBe(cityId);
  });

  it('returns 409 when a similar community already exists', async () => {
    // Create a community with the same name
    await createCommunity(testDb, {
      cityId,
      name: 'Stuttgart Tamil Sangam',
      slug: 'stuttgart-tamil-sangam',
    });
    const res = await communityPOST(
      makeReq('/api/v1/submissions/community', validPayload(), headers),
    );
    expect(res.status).toBe(409);
  });
});

// ─── POST /api/v1/submissions/suggest ──────────────────────────────────────

describe('POST /api/v1/submissions/suggest', () => {
  it('returns 401 without token', async () => {
    const res = await suggestPOST(makeReq('/api/v1/submissions/suggest', {}, {}));
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing required fields', async () => {
    const res = await suggestPOST(makeReq('/api/v1/submissions/suggest', { citySlug }, headers));
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown citySlug', async () => {
    const res = await suggestPOST(
      makeReq(
        '/api/v1/submissions/suggest',
        { name: 'Kabaddi Club', citySlug: 'nowhere' },
        headers,
      ),
    );
    expect(res.status).toBe(404);
  });

  it('creates a COMMUNITY_SUGGESTION pipeline item and returns 201', async () => {
    const res = await suggestPOST(
      makeReq(
        '/api/v1/submissions/suggest',
        {
          name: 'Stuttgart Kabaddi Club',
          description: 'Kabaddi enthusiasts in Stuttgart',
          citySlug,
          contactEmail: 'fan@example.com',
          note: 'I saw them at Cannstatter Wasen',
        },
        headers,
      ),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.entityType).toBe('COMMUNITY');
    expect(body.status).toBe('PENDING');

    const item = await testDb.pipelineItem.findUnique({ where: { id: body.id } });
    expect(item?.sourceType).toBe('COMMUNITY_SUGGESTION');
    expect(item?.submittedBy).toBe(USER_ID);
    const data = item?.extractedData as Record<string, unknown>;
    expect(data.name).toBe('Stuttgart Kabaddi Club');
    expect(data.note).toBe('I saw them at Cannstatter Wasen');
  });
});
