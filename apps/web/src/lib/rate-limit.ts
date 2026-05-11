/**
 * Simple in-memory sliding-window rate limiter.
 * Suitable for single-process deployments. For multi-instance deployments,
 * replace with Redis-backed rate limiting (e.g. @upstash/ratelimit).
 */

type RateLimitEntry = { timestamps: number[] };

const stores = new Map<string, Map<string, RateLimitEntry>>();

// Evict stale keys every 5 minutes to prevent memory growth under bot traffic
setInterval(
  () => {
    const now = Date.now();
    for (const [, store] of stores) {
      for (const [key, entry] of store) {
        if (
          entry.timestamps.length === 0 ||
          entry.timestamps[entry.timestamps.length - 1] < now - 3600_000
        ) {
          store.delete(key);
        }
      }
    }
  },
  5 * 60 * 1000,
).unref();

export interface RateLimitConfig {
  /** Unique name for this limiter (e.g. 'magic-link', 'track') */
  name: string;
  /** Maximum number of requests allowed in the window */
  maxRequests: number;
  /** Window size in milliseconds */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

/**
 * Check whether a request from `key` (typically an IP or email) is within limits.
 * Returns whether the request is allowed and how many requests remain.
 */
export function checkRateLimit(config: RateLimitConfig, key: string): RateLimitResult {
  if (!stores.has(config.name)) {
    stores.set(config.name, new Map());
  }
  const store = stores.get(config.name)!;

  const now = Date.now();
  const windowStart = now - config.windowMs;

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Prune expired timestamps
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

  if (entry.timestamps.length >= config.maxRequests) {
    const oldestInWindow = entry.timestamps[0];
    const retryAfterMs = oldestInWindow + config.windowMs - now;
    return { allowed: false, remaining: 0, retryAfterMs: Math.max(retryAfterMs, 0) };
  }

  entry.timestamps.push(now);
  return {
    allowed: true,
    remaining: config.maxRequests - entry.timestamps.length,
    retryAfterMs: 0,
  };
}

/** Pre-configured limiters */

export const magicLinkLimiter: RateLimitConfig = {
  name: 'magic-link',
  maxRequests: 3,
  windowMs: 15 * 60 * 1000, // 3 requests per 15 minutes per email
};

/**
 * Per-IP cap for magic-link requests. Stops a single source from probing
 * many emails or bypassing the per-email limit by varying the address.
 */
export const magicLinkIpLimiter: RateLimitConfig = {
  name: 'magic-link-ip',
  maxRequests: 10,
  windowMs: 60 * 60 * 1000, // 10 requests per hour per IP
};

/**
 * Hard global ceiling on magic-link emails sent system-wide. Caps Resend
 * spend regardless of attacker pattern (many IPs, many emails). Use a
 * single fixed key so all callers share the same window.
 */
export const magicLinkGlobalLimiter: RateLimitConfig = {
  name: 'magic-link-global',
  maxRequests: 50,
  windowMs: 60 * 60 * 1000, // 50 magic-link emails per hour total
};

export const MAGIC_LINK_GLOBAL_KEY = '__global__';

export const trackLimiter: RateLimitConfig = {
  name: 'track',
  maxRequests: 60,
  windowMs: 60 * 1000, // 60 requests per minute per IP
};

export const submitLimiter: RateLimitConfig = {
  name: 'submit',
  maxRequests: 5,
  windowMs: 60 * 60 * 1000, // 5 submissions per hour per IP
};

export const reportLimiter: RateLimitConfig = {
  name: 'report',
  maxRequests: 10,
  windowMs: 60 * 60 * 1000, // 10 reports per hour per IP
};
