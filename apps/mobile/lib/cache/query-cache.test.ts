import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { clearCache, invalidate, invalidatePrefix, peekCache, queryCache } from './query-cache';

describe('query-cache', () => {
  it('returns the fetched value and caches it for the TTL window', async () => {
    clearCache();
    let calls = 0;
    const fetcher = async () => {
      calls += 1;
      return { calls };
    };

    const a = await queryCache('k', fetcher, { ttl: 1000 });
    const b = await queryCache('k', fetcher, { ttl: 1000 });
    assert.equal(a.calls, 1);
    assert.equal(b.calls, 1);
    assert.equal(calls, 1);
    assert.deepEqual(peekCache<{ calls: number }>('k'), { calls: 1 });
  });

  it('de-duplicates concurrent in-flight requests', async () => {
    clearCache();
    let calls = 0;
    const fetcher = async () => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 10));
      return calls;
    };

    const [a, b, c] = await Promise.all([
      queryCache('dedup', fetcher),
      queryCache('dedup', fetcher),
      queryCache('dedup', fetcher),
    ]);
    assert.equal(a, 1);
    assert.equal(b, 1);
    assert.equal(c, 1);
    assert.equal(calls, 1);
  });

  it('refetches once the TTL has elapsed', async () => {
    clearCache();
    let calls = 0;
    const fetcher = async () => ++calls;

    await queryCache('ttl', fetcher, { ttl: 5 });
    await new Promise((r) => setTimeout(r, 15));
    const second = await queryCache('ttl', fetcher, { ttl: 5 });
    assert.equal(second, 2);
  });

  it('force bypasses cache and repopulates', async () => {
    clearCache();
    let calls = 0;
    const fetcher = async () => ++calls;

    await queryCache('f', fetcher);
    const second = await queryCache('f', fetcher, { force: true });
    assert.equal(second, 2);
    assert.equal(peekCache<number>('f'), 2);
  });

  it('invalidate / invalidatePrefix drop entries', async () => {
    clearCache();
    await queryCache('a:1', async () => 1);
    await queryCache('a:2', async () => 2);
    await queryCache('b:1', async () => 3);

    invalidate('a:1');
    assert.equal(peekCache('a:1'), undefined);
    assert.equal(peekCache('a:2'), 2);

    invalidatePrefix('a:');
    assert.equal(peekCache('a:2'), undefined);
    assert.equal(peekCache('b:1'), 3);
  });

  it('does not cache failures', async () => {
    clearCache();
    let attempt = 0;
    const fetcher = async () => {
      attempt += 1;
      if (attempt === 1) throw new Error('boom');
      return attempt;
    };

    await assert.rejects(() => queryCache('fail', fetcher));
    const second = await queryCache('fail', fetcher);
    assert.equal(second, 2);
  });
});
