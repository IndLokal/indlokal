import assert from 'node:assert/strict';
import test from 'node:test';
import { createMemorySecureStore, createTokenStore } from '../token-store';

const TOKENS = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  accessExpiresAt: new Date(Date.now() + 60_000).toISOString(),
  refreshExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  user: {
    id: 'ck_test_user',
    email: 'test@example.com',
    displayName: null,
    avatarUrl: null,
    role: 'USER' as const,
    cityId: null,
    personaSegments: [],
    preferredLanguages: [],
    onboardingComplete: false,
    createdAt: new Date().toISOString(),
    lastActiveAt: null,
  },
};

test('createTokenStore writes and reads token bundle', async () => {
  const store = createTokenStore(createMemorySecureStore());
  await store.write(TOKENS);

  const loaded = await store.read();
  assert.deepEqual(loaded, TOKENS);
});

test('createTokenStore clears token bundle', async () => {
  const store = createTokenStore(createMemorySecureStore());
  await store.write(TOKENS);
  await store.clear();

  const loaded = await store.read();
  assert.equal(loaded, null);
});
