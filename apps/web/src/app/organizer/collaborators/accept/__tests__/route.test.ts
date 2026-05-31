import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => {
  return {
    cookieStore: {
      get: vi.fn<(name: string) => { value: string } | undefined>(),
      delete: vi.fn<(name: string) => void>(),
    },
    txMock: vi.fn(),
    createSessionMock: vi.fn(async () => undefined),
  };
});

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => mocks.cookieStore),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

vi.mock('@/lib/db', () => ({
  db: {
    $transaction: mocks.txMock,
  },
}));

vi.mock('@/lib/session', () => ({
  hashToken: vi.fn(async () => 'hashed-token'),
  generateSessionToken: vi.fn(() => 'session-token'),
  createSession: mocks.createSessionMock,
}));

import { GET, POST } from '../route';

function buildPostRequest(form: Record<string, string>) {
  return new NextRequest('http://localhost/organizer/collaborators/accept', {
    method: 'POST',
    body: new URLSearchParams(form),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  });
}

describe('organizer collaborator accept route', () => {
  beforeEach(() => {
    mocks.cookieStore.get.mockReset();
    mocks.cookieStore.delete.mockReset();
    mocks.txMock.mockReset();
    mocks.createSessionMock.mockReset();
  });

  it('GET renders accept page and includes hidden token/invite fields', async () => {
    const req = new NextRequest(
      'http://localhost/organizer/collaborators/accept?token=abc123&invite=invite123',
      { method: 'GET' },
    );

    const res = await GET(req);
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(html).toContain('name="token" value="abc123"');
    expect(html).toContain('name="invite" value="invite123"');
  });

  it('POST with missing token/invite redirects to invalid_invite', async () => {
    const req = buildPostRequest({});
    const res = await POST(req);

    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toContain('/organizer/login?error=invalid_invite');
    expect(mocks.txMock).not.toHaveBeenCalled();
  });

  it('POST with valid transaction result signs in and redirects to organizer', async () => {
    mocks.txMock.mockResolvedValueOnce({ ok: true, userId: 'user_1' });

    const req = buildPostRequest({ token: 'raw_token', invite: 'invite_1' });
    const res = await POST(req);

    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toContain('/organizer?inviteAccepted=1');
    expect(mocks.createSessionMock).toHaveBeenCalledWith('user_1', 'session-token');
    expect(mocks.cookieStore.delete).toHaveBeenCalledWith('collab_invite_token');
    expect(mocks.cookieStore.delete).toHaveBeenCalledWith('collab_invite_id');
  });

  it('POST redirects to expired_token when transaction reports expired token', async () => {
    mocks.txMock.mockResolvedValueOnce({ ok: false, error: 'expired_token' });

    const req = buildPostRequest({ token: 'raw_token', invite: 'invite_1' });
    const res = await POST(req);

    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toContain('/organizer/login?error=expired_token');
    expect(mocks.createSessionMock).not.toHaveBeenCalled();
  });
});
