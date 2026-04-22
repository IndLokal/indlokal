/**
 * Tiny in-memory query cache for mobile screens.
 *
 * Goals:
 *   - Avoid re-fetching the same payload on every tab focus / keystroke.
 *   - De-duplicate concurrent in-flight requests for the same key.
 *   - Stay tiny — no external deps, ~50 lines.
 *
 * Not goals:
 *   - Cross-launch persistence (cleared on cold start). The CDN layer on the
 *     web side already gives us fast network responses; this just removes the
 *     per-focus round-trip during a single session.
 *   - Stale-while-revalidate. If you read while stale, you get a fresh fetch.
 */

type Entry<T> = {
  value: T;
  expiresAt: number;
};

const store = new Map<string, Entry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

export interface QueryOptions {
  /** Time-to-live in milliseconds. Default 5 minutes. */
  ttl?: number;
  /** Bypass the cache and force a fresh fetch (still populates cache on success). */
  force?: boolean;
}

const DEFAULT_TTL = 5 * 60 * 1000;

/**
 * Returns the cached value for `key` if fresh, otherwise calls `fetcher` once
 * (de-duplicated across concurrent callers) and caches the result.
 */
export async function queryCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: QueryOptions = {},
): Promise<T> {
  const ttl = options.ttl ?? DEFAULT_TTL;
  const now = Date.now();

  if (!options.force) {
    const cached = store.get(key) as Entry<T> | undefined;
    if (cached && cached.expiresAt > now) {
      return cached.value;
    }
    const pending = inFlight.get(key) as Promise<T> | undefined;
    if (pending) return pending;
  }

  const promise = (async () => {
    try {
      const value = await fetcher();
      store.set(key, { value, expiresAt: Date.now() + ttl });
      return value;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, promise);
  return promise;
}

/** Synchronously read the cached value if still fresh, else `undefined`. */
export function peekCache<T>(key: string): T | undefined {
  const entry = store.get(key) as Entry<T> | undefined;
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) return undefined;
  return entry.value;
}

/** Drop a single key (e.g. after a mutation that invalidates it). */
export function invalidate(key: string): void {
  store.delete(key);
}

/** Drop all keys with a matching prefix (e.g. `bookmarks:`). */
export function invalidatePrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

/** Clear everything. Intended for tests + sign-out. */
export function clearCache(): void {
  store.clear();
  inFlight.clear();
}
