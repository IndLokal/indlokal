import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';

const COOKIE_NAME = 'lp_session';
const TOKEN_TTL_HOURS = 24;

/** Hash a token with SHA-256 for safe DB storage (the raw token is only in the cookie) */
export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Generate a cryptographically random session token */
export function generateSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Compute expiry timestamp for a new token */
export function tokenExpiry(): Date {
  const d = new Date();
  d.setHours(d.getHours() + TOKEN_TTL_HOURS);
  return d;
}

/**
 * Persist a session: hash the raw token and store it in the DB, then set the raw token as a cookie.
 * Call this instead of writing sessionToken to the DB directly.
 */
export async function createSession(userId: string, rawToken: string) {
  const hashed = await hashToken(rawToken);
  await db.user.update({
    where: { id: userId },
    data: { sessionToken: hashed, sessionTokenExpiry: tokenExpiry() },
  });
  await setSessionCookie(rawToken);
}

/** Set the session cookie (call from a Route Handler, not a Server Action) */
export async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: TOKEN_TTL_HOURS * 60 * 60,
  });
}

/** Read the session cookie, hash it, and return the authenticated user or null */
export async function getSessionUser() {
  const jar = await cookies();
  const rawToken = jar.get(COOKIE_NAME)?.value;
  if (!rawToken) return null;

  const hashed = await hashToken(rawToken);

  const user = await db.user.findUnique({
    where: { sessionToken: hashed },
    include: {
      claimedCommunities: {
        where: { claimState: 'CLAIMED' },
        include: {
          city: { select: { id: true, name: true, slug: true } },
          categories: { include: { category: true } },
          accessChannels: true,
        },
      },
      savedCommunities: { select: { communityId: true } },
      savedEvents: { select: { eventId: true } },
    },
  });

  if (!user) return null;
  if (!user.sessionToken || !user.sessionTokenExpiry || user.sessionTokenExpiry < new Date())
    return null;

  return user;
}

/** Require a valid session — redirect to login if missing */
export async function requireSessionUser() {
  const user = await getSessionUser();
  if (!user) redirect('/organizer/login');
  return user;
}

/** Require PLATFORM_ADMIN role — redirect to home if not authorized */
export async function requireAdmin() {
  const user = await getSessionUser();
  if (!user || user.role !== 'PLATFORM_ADMIN') redirect('/');
  return user;
}

/** Clear the session cookie and invalidate the token in the DB */
export async function clearSessionCookie() {
  const jar = await cookies();
  const rawToken = jar.get(COOKIE_NAME)?.value;
  jar.delete(COOKIE_NAME);

  if (rawToken) {
    const hashed = await hashToken(rawToken);
    await db.user.updateMany({
      where: { sessionToken: hashed },
      data: { sessionToken: null, sessionTokenExpiry: null },
    });
  }
}
