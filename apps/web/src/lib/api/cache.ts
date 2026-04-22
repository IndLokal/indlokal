/**
 * Cache-Control helpers for public read APIs.
 *
 * Pattern: edge/CDN caches the response for `sMaxAge` seconds, then serves
 * stale for up to `swr` seconds while a background refresh happens. Browsers
 * follow `maxAge` (kept short to avoid stale UI on revisit).
 */
import type { NextResponse } from 'next/server';

export interface PublicCacheOptions {
  /** Seconds the CDN/proxy may cache the response. */
  sMaxAge: number;
  /** Seconds a stale response may be served while revalidating. Defaults to 2x sMaxAge. */
  swr?: number;
  /** Seconds the browser may cache. Defaults to 0 (always revalidate at edge). */
  maxAge?: number;
}

/**
 * Apply public Cache-Control + CDN-Cache-Control headers to a NextResponse and
 * return it. Use on read-only, non-personalized endpoints.
 */
export function withPublicCache<T extends NextResponse>(
  res: T,
  { sMaxAge, swr, maxAge = 0 }: PublicCacheOptions,
): T {
  const stale = swr ?? sMaxAge * 2;
  const value = `public, max-age=${maxAge}, s-maxage=${sMaxAge}, stale-while-revalidate=${stale}`;
  res.headers.set('Cache-Control', value);
  // Hint for CDNs that ignore Cache-Control s-maxage (e.g. some Vercel/Cloudflare configs).
  res.headers.set('CDN-Cache-Control', `public, s-maxage=${sMaxAge}`);
  return res;
}
