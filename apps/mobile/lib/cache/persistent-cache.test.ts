import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { PersistentCache, CACHE_KEYS, type KeyValueStore } from './persistent-cache';

function memoryStore(): KeyValueStore & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    async getItem(key) {
      return map.has(key) ? (map.get(key) as string) : null;
    },
    async setItem(key, value) {
      map.set(key, value);
    },
    async removeItem(key) {
      map.delete(key);
    },
  };
}

describe('cache/persistent-cache', () => {
  it('stores and reads fresh values', async () => {
    let now = 1000;
    const cache = new PersistentCache(memoryStore(), { now: () => now });
    await cache.set('k', { a: 1 }, 5000);
    assert.deepEqual(await cache.get<{ a: number }>('k'), { a: 1 });
  });

  it('returns null after expiry and clears the entry', async () => {
    let now = 0;
    const store = memoryStore();
    const cache = new PersistentCache(store, { now: () => now });
    await cache.set('k', 'v', 1000);
    now = 1000;
    assert.equal(await cache.get('k'), null);
    assert.equal(store.map.size, 0);
  });

  it('treats version mismatches as a miss', async () => {
    const store = memoryStore();
    const writer = new PersistentCache(store, { version: 1, now: () => 0 });
    await writer.set('k', 'v', 999999);
    const reader = new PersistentCache(store, { version: 2, now: () => 0 });
    assert.equal(await reader.get('k'), null);
  });

  it('returns null and clears on corrupt JSON', async () => {
    const store = memoryStore();
    store.map.set('cache:k', '{not json');
    const cache = new PersistentCache(store);
    assert.equal(await cache.get('k'), null);
    assert.equal(store.map.has('cache:k'), false);
  });

  it('swallows store failures on set', async () => {
    const failing: KeyValueStore = {
      async getItem() {
        return null;
      },
      async setItem() {
        throw new Error('quota');
      },
      async removeItem() {},
    };
    const cache = new PersistentCache(failing);
    await assert.doesNotReject(cache.set('k', 'v'));
  });

  it('builds stable cache keys', () => {
    assert.equal(CACHE_KEYS.discoverFeed('stuttgart'), 'discover:stuttgart');
    assert.equal(CACHE_KEYS.savedItems, 'saved:items');
  });
});
