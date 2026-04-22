import assert from 'node:assert/strict';
import test from 'node:test';
import { createAuthClient } from '../client';
import { createMemorySecureStore, createTokenStore } from '../token-store';

const NOW = Date.now();

function makeAuthTokens(accessToken: string, refreshToken: string) {
  return {
    accessToken,
    refreshToken,
    accessExpiresAt: new Date(NOW + 60_000).toISOString(),
    refreshExpiresAt: new Date(NOW + 3_600_000).toISOString(),
    user: {
      id: 'cmauthfixture0000000000000001',
      email: 'mobile@example.com',
      displayName: null,
      avatarUrl: null,
      role: 'USER' as const,
      cityId: null,
      personaSegments: [],
      preferredLanguages: [],
      onboardingComplete: false,
      createdAt: new Date(NOW).toISOString(),
      lastActiveAt: null,
    },
  };
}

test('createAuthClient deduplicates concurrent refresh calls', async () => {
  const store = createTokenStore(createMemorySecureStore());
  await store.write(makeAuthTokens('stale-access', 'refresh-token-1'));

  let callCount = 0;
  const fetchMock: typeof fetch = async () => {
    callCount += 1;
    return new Response(JSON.stringify(makeAuthTokens('fresh-access', 'refresh-token-2')), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const client = createAuthClient({
    baseUrl: 'https://indlokal.com',
    fetchImpl: fetchMock,
    store,
  });

  await Promise.all([
    client.refreshAccessToken(),
    client.refreshAccessToken(),
    client.refreshAccessToken(),
  ]);

  assert.equal(callCount, 1);
  const stored = await client.getTokens();
  assert.equal(stored?.accessToken, 'fresh-access');
  assert.equal(stored?.refreshToken, 'refresh-token-2');
});
