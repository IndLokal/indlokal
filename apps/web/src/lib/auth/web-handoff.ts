/**
 * Cross-surface auth hand-off (app → web) — TDD-0058.
 *
 * A signed-in mobile user (JWT in SecureStore) mints a one-time, short-lived
 * token via `POST /api/v1/auth/handoff`; the web consume route
 * (`GET /auth/handoff`) exchanges it for the standard `lp_session` cookie so
 * the user lands authenticated in an in-app browser — never a long-lived
 * secret in a URL.
 *
 * The `next` path can target any safe in-product route, including role-scoped
 * surfaces such as `/admin`, `/organizer`, and `/ambassador`; authorization is
 * still enforced server-side after the cookie session is established.
 *
 * The raw token lives only in the returned URL; the DB stores its SHA-256 hash.
 * Single-use is enforced atomically via an `usedAt`-guarded update.
 */

import { db } from '@/lib/db';
import { generateSessionToken, hashToken } from '@/lib/session';
import { siteConfig } from '@/lib/config/site';

/** Short window: the in-app browser should open the URL within seconds. */
export const WEB_HANDOFF_TTL_SECONDS = 90;

/** Default landing path when none is supplied or the requested one is unsafe. */
export const WEB_HANDOFF_DEFAULT_NEXT = '/me';

/**
 * Normalize a requested post-handoff destination to a safe, in-product path.
 *
 * Only same-origin relative paths are allowed: a single leading `/`, no
 * protocol-relative `//`, no backslashes, no control characters. Anything else
 * falls back to {@link WEB_HANDOFF_DEFAULT_NEXT} so the token can never be used
 * as an open-redirect.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (typeof next !== 'string') return WEB_HANDOFF_DEFAULT_NEXT;
  const trimmed = next.trim();
  if (trimmed.length === 0 || trimmed.length > 500) return WEB_HANDOFF_DEFAULT_NEXT;
  // Must be a relative path rooted at '/', but not protocol-relative ('//').
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return WEB_HANDOFF_DEFAULT_NEXT;
  // Reject backslashes (browsers treat '\' like '/') and control chars.
  if (/[\\\u0000-\u001f\u007f]/.test(trimmed)) return WEB_HANDOFF_DEFAULT_NEXT;
  return trimmed;
}

/** Resolve the public origin the in-app browser should open. */
function appOrigin(): string {
  // siteConfig.url already resolves NEXT_PUBLIC_APP_URL ?? production default.
  return siteConfig.url;
}

export type MintedWebHandoff = {
  /** Absolute https URL to open in the in-app browser (contains the token). */
  url: string;
  expiresAt: Date;
  next: string;
};

/**
 * Create a one-time hand-off token for `userId` and return the URL the mobile
 * client should open. Persists only the token hash.
 */
export async function mintWebHandoffToken(input: {
  userId: string;
  next?: string | null;
}): Promise<MintedWebHandoff> {
  const next = safeNextPath(input.next);
  const rawToken = generateSessionToken();
  const tokenHash = await hashToken(rawToken);
  const expiresAt = new Date(Date.now() + WEB_HANDOFF_TTL_SECONDS * 1000);

  await db.webHandoffToken.create({
    data: { tokenHash, userId: input.userId, next, expiresAt },
  });

  const url = new URL('/auth/handoff', appOrigin());
  url.searchParams.set('token', rawToken);
  return { url: url.toString(), expiresAt, next };
}

export type ConsumedWebHandoff = { userId: string; next: string };

/**
 * Atomically consume a hand-off token. Returns the user + landing path on
 * success, or null if the token is unknown, expired, or already used. The
 * `usedAt`-guarded update guarantees single-use even under concurrent opens.
 */
export async function consumeWebHandoffToken(rawToken: string): Promise<ConsumedWebHandoff | null> {
  if (!rawToken) return null;
  const tokenHash = await hashToken(rawToken);

  const record = await db.webHandoffToken.findUnique({ where: { tokenHash } });
  if (!record) return null;
  if (record.usedAt) return null;
  if (record.expiresAt.getTime() <= Date.now()) return null;

  // Single-use guard: only the first concurrent caller flips usedAt.
  const claimed = await db.webHandoffToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claimed.count !== 1) return null;

  return { userId: record.userId, next: safeNextPath(record.next) };
}
