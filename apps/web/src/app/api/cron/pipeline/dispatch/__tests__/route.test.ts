/**
 * Unit tests for POST /api/cron/pipeline/dispatch (PRD/TDD-0029).
 *
 * Stubs `getRuntimeEnabledRegions` and `fetch` - no DB required.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/modules/pipeline/config/runtime-config', () => ({
  getRuntimeEnabledRegions: vi.fn(),
}));

vi.mock('@/lib/analytics/server', () => ({
  captureServerEvent: vi.fn(async () => {}),
}));

import { POST } from '@/app/api/cron/pipeline/dispatch/route';
import { getRuntimeEnabledRegions } from '@/modules/pipeline/config/runtime-config';

const SECRET = 'test-secret';

function buildReq(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/cron/pipeline/dispatch', {
    method: 'POST',
    headers: {
      host: 'localhost',
      authorization: `Bearer ${SECRET}`,
      ...headers,
    },
  });
}

function fakeRegion(id: string) {
  return { id, citySlugs: [], state: null } as unknown as Awaited<
    ReturnType<typeof getRuntimeEnabledRegions>
  >[number];
}

describe('POST /api/cron/pipeline/dispatch', () => {
  const originalEnv = { ...process.env };
  const fetchMock = vi.fn();

  beforeEach(() => {
    process.env.CRON_SECRET = SECRET;
    process.env.APP_URL = 'https://example.test';
    delete process.env.PIPELINE_DISPATCH_CONCURRENCY;
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    (getRuntimeEnabledRegions as unknown as ReturnType<typeof vi.fn>).mockReset();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it('returns 401 without bearer', async () => {
    const req = new NextRequest('http://localhost/api/cron/pipeline/dispatch', {
      method: 'POST',
      headers: { host: 'localhost' },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 200 with empty dispatched[] when no regions are enabled', async () => {
    (getRuntimeEnabledRegions as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
    const res = await POST(buildReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dispatched).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('dispatches one POST per enabled region', async () => {
    (getRuntimeEnabledRegions as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      fakeRegion('berlin'),
      fakeRegion('bavaria'),
      fakeRegion('hesse'),
    ]);
    fetchMock.mockResolvedValue({ ok: true, status: 200 } as Response);

    const res = await POST(buildReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.dispatched.sort()).toEqual(['bavaria', 'berlin', 'hesse']);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const urls = fetchMock.mock.calls.map((c) => new URL(String(c[0])));
    const regionsFromUrls = urls.map((url) => url.searchParams.get('region')).sort();
    expect(regionsFromUrls).toEqual(['bavaria', 'berlin', 'hesse']);

    for (const url of urls) {
      expect(url.origin).toBe('https://example.test');
      expect(url.pathname).toBe('/api/cron/pipeline');
      expect(url.searchParams.get('runMode')).toBeTruthy();
      expect(url.searchParams.get('sourceIntentProfile')).toBeTruthy();
    }

    for (const call of fetchMock.mock.calls) {
      const init = call[1] as RequestInit & { headers: Record<string, string> };
      expect(init.method).toBe('POST');
      expect(init.headers.authorization).toBe(`Bearer ${SECRET}`);
    }
  });

  it('reports per-region failures without failing siblings', async () => {
    (getRuntimeEnabledRegions as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      fakeRegion('berlin'),
      fakeRegion('bavaria'),
    ]);
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('region=bavaria')) {
        return { ok: false, status: 500 } as Response;
      }
      return { ok: true, status: 200 } as Response;
    });

    const res = await POST(buildReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.dispatched).toEqual(['berlin']);
    expect(body.failed).toHaveLength(1);
    expect(body.failed[0].regionId).toBe('bavaria');
    expect(body.failed[0].status).toBe(500);
  });

  it('captures network errors per region', async () => {
    (getRuntimeEnabledRegions as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      fakeRegion('berlin'),
    ]);
    fetchMock.mockRejectedValueOnce(new Error('ENETUNREACH'));

    const res = await POST(buildReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.failed[0]).toMatchObject({
      regionId: 'berlin',
      status: null,
      error: 'ENETUNREACH',
    });
  });
});
