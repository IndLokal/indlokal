import assert from 'node:assert/strict';
import test from 'node:test';
import type { AuthClient } from '../client';
import { isHttpsUrl, requestWebHandoffUrl } from '../web-handoff';

const NOW = Date.now();

function makeResponse(url: string) {
  return { url, expiresAt: new Date(NOW + 90_000).toISOString() };
}

type StubCalls = { path?: string; body?: unknown };

function makeClient(
  calls: StubCalls,
  postImpl: (path: string, body: unknown) => Promise<unknown>,
): Pick<AuthClient, 'postAuthed'> {
  return {
    async postAuthed(path: string, body: unknown) {
      calls.path = path;
      calls.body = body;
      return postImpl(path, body);
    },
  } as unknown as Pick<AuthClient, 'postAuthed'>;
}

test('isHttpsUrl accepts https and rejects other schemes', () => {
  assert.equal(isHttpsUrl('https://indlokal.com/auth/handoff?token=abc'), true);
  assert.equal(isHttpsUrl('http://indlokal.com'), false);
  assert.equal(isHttpsUrl('javascript:alert(1)'), false);
  assert.equal(isHttpsUrl('not a url'), false);
});

test('requestWebHandoffUrl posts next and returns the https url', async () => {
  const calls: StubCalls = {};
  const client = makeClient(calls, async () =>
    makeResponse('https://indlokal.com/auth/handoff?token=tok'),
  );

  const url = await requestWebHandoffUrl(client, { next: '/me' });

  assert.equal(calls.path, '/api/v1/auth/handoff');
  assert.deepEqual(calls.body, { next: '/me' });
  assert.equal(url, 'https://indlokal.com/auth/handoff?token=tok');
});

test('requestWebHandoffUrl supports role-scoped web destinations', async () => {
  const calls: StubCalls = {};
  const client = makeClient(calls, async () =>
    makeResponse('https://indlokal.com/auth/handoff?token=tok'),
  );

  await requestWebHandoffUrl(client, { next: '/admin' });

  assert.equal(calls.path, '/api/v1/auth/handoff');
  assert.deepEqual(calls.body, { next: '/admin' });
});

test('requestWebHandoffUrl omits next when not provided', async () => {
  const calls: StubCalls = {};
  const client = makeClient(calls, async () =>
    makeResponse('https://indlokal.com/auth/handoff?token=tok'),
  );

  await requestWebHandoffUrl(client);

  assert.deepEqual(calls.body, { next: undefined });
});

test('requestWebHandoffUrl rejects a non-https url from the backend', async () => {
  const calls: StubCalls = {};
  const client = makeClient(calls, async () =>
    makeResponse('http://evil.example.com/auth/handoff?token=tok'),
  );

  await assert.rejects(() => requestWebHandoffUrl(client, { next: '/me' }), /non-https/);
});

test('requestWebHandoffUrl rejects a malformed backend response', async () => {
  const calls: StubCalls = {};
  const client = makeClient(calls, async () => ({ url: 'https://indlokal.com' }));

  // Missing expiresAt — Zod contract should reject.
  await assert.rejects(() => requestWebHandoffUrl(client, { next: '/me' }));
});
