import assert from 'node:assert/strict';
import test from 'node:test';
import type { AuthClient } from '../client';
import { signInWithGoogleCode } from '../google-exchange';

const NOW = Date.now();

function makeAuthTokens() {
  return {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    accessExpiresAt: new Date(NOW + 60_000).toISOString(),
    refreshExpiresAt: new Date(NOW + 3_600_000).toISOString(),
    user: {
      id: 'cmauthfixture0000000000000001',
      email: 'mobile@example.com',
      displayName: null,
      avatarUrl: null,
      role: 'USER' as const,
      cityId: null,
      cityName: null,
      personaSegments: [],
      preferredLanguages: [],
      onboardingComplete: false,
      roleAssignments: [],
      claimedCommunities: [],
      createdAt: new Date(NOW).toISOString(),
      lastActiveAt: null,
    },
  };
}

type StubCalls = {
  postPath?: string;
  postBody?: unknown;
  stored?: unknown;
};

function makeClient(
  calls: StubCalls,
  postImpl: (path: string, body: unknown) => Promise<unknown>,
): AuthClient {
  return {
    async postPublic(path: string, body: unknown) {
      calls.postPath = path;
      calls.postBody = body;
      return postImpl(path, body);
    },
    async setTokens(tokens: unknown) {
      calls.stored = tokens;
    },
  } as unknown as AuthClient;
}

test('signInWithGoogleCode posts the code and stores the returned tokens', async () => {
  const calls: StubCalls = {};
  const tokens = makeAuthTokens();
  const client = makeClient(calls, async () => tokens);

  const result = await signInWithGoogleCode(client, {
    code: 'auth-code',
    redirectUri: 'https://indlokal.com/auth/google/callback',
    codeVerifier: 'verifier',
  });

  assert.equal(calls.postPath, '/api/v1/auth/google');
  assert.deepEqual(calls.postBody, {
    code: 'auth-code',
    redirectUri: 'https://indlokal.com/auth/google/callback',
    codeVerifier: 'verifier',
  });
  assert.deepEqual(calls.stored, tokens);
  assert.equal(result.accessToken, 'access-token');
});

test('signInWithGoogleCode rejects invalid input before calling the backend', async () => {
  const calls: StubCalls = {};
  const client = makeClient(calls, async () => makeAuthTokens());

  await assert.rejects(() =>
    signInWithGoogleCode(client, {
      // Missing code — Zod contract should reject.
      code: '',
      redirectUri: 'not-a-url',
    }),
  );
  assert.equal(calls.postPath, undefined, 'no request should be sent for invalid input');
  assert.equal(calls.stored, undefined);
});

test('signInWithGoogleCode does not store tokens when the backend fails', async () => {
  const calls: StubCalls = {};
  const client = makeClient(calls, async () => {
    throw new Error('backend exchange failed');
  });

  await assert.rejects(
    () =>
      signInWithGoogleCode(client, {
        code: 'auth-code',
        redirectUri: 'https://indlokal.com/auth/google/callback',
      }),
    /backend exchange failed/,
  );
  assert.equal(calls.stored, undefined);
});
