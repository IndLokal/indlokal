/**
 * Persistent, expiring cache - PRD/TDD-0040.
 *
 * Pure module (no Expo/RN imports). Wraps an injected key/value store (in the
 * app, AsyncStorage via the `.expo` wrapper) to persist read-mostly data
 * across cold starts so the Discover feed and saved items render instantly
 * offline. Entries carry a version + expiry; stale or version-mismatched
 * entries are treated as misses.
 */

export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

interface CacheEnvelope<T> {
  v: number;
  storedAt: number;
  expiresAt: number;
  data: T;
}

const KEY_PREFIX = 'cache:';
const CACHE_VERSION = 1;
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours

export interface PersistentCacheOptions {
  /** Bump to invalidate all previously written entries after a shape change. */
  version?: number;
  defaultTtlMs?: number;
  /** Injectable clock for deterministic tests. */
  now?: () => number;
}

export class PersistentCache {
  private readonly version: number;
  private readonly defaultTtlMs: number;
  private readonly now: () => number;

  constructor(
    private readonly store: KeyValueStore,
    options: PersistentCacheOptions = {},
  ) {
    this.version = options.version ?? CACHE_VERSION;
    this.defaultTtlMs = options.defaultTtlMs ?? DEFAULT_TTL_MS;
    this.now = options.now ?? Date.now;
  }

  private storageKey(key: string): string {
    return `${KEY_PREFIX}${key}`;
  }

  /** Read a fresh value, or null on miss/expiry/version-mismatch/corruption. */
  async get<T>(key: string): Promise<T | null> {
    let raw: string | null;
    try {
      raw = await this.store.getItem(this.storageKey(key));
    } catch {
      return null;
    }
    if (!raw) return null;

    let envelope: CacheEnvelope<T>;
    try {
      envelope = JSON.parse(raw) as CacheEnvelope<T>;
    } catch {
      await this.delete(key);
      return null;
    }

    if (envelope.v !== this.version || this.now() >= envelope.expiresAt) {
      await this.delete(key);
      return null;
    }
    return envelope.data;
  }

  /** Persist a value with an optional TTL override. Best-effort - never throws. */
  async set<T>(key: string, data: T, ttlMs?: number): Promise<void> {
    const storedAt = this.now();
    const envelope: CacheEnvelope<T> = {
      v: this.version,
      storedAt,
      expiresAt: storedAt + (ttlMs ?? this.defaultTtlMs),
      data,
    };
    try {
      await this.store.setItem(this.storageKey(key), JSON.stringify(envelope));
    } catch {
      // Persisting is best-effort; ignore quota/serialization failures.
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.store.removeItem(this.storageKey(key));
    } catch {
      // ignore
    }
  }
}

export const CACHE_KEYS = {
  discoverFeed: (citySlug: string, lens = 'all') => `discover:${citySlug}:${lens}`,
  savedItems: 'saved:items',
} as const;
