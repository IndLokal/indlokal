import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';

const COOKIE_NAME = 'lp_session';
const TOKEN_TTL_HOURS = 24;

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

/** Read the session cookie and return the authenticated user, or null */
export async function getSessionUser() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const user = await db.user.findUnique({
    where: { sessionToken: token },
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
  if (!user.sessionTokenExpiry || user.sessionTokenExpiry < new Date()) return null;

  return user;
}

/** Require a valid session — redirect to login if missing */
export async function requireSessionUser() {
  const user = await getSessionUser();
  if (!user) redirect('/organizer/login');
  return user;
}

/** Clear the session cookie and invalidate the token in the DB */
export async function clearSessionCookie() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  jar.delete(COOKIE_NAME);

  // Null out the DB token so it cannot be reused even before the 24h expiry
  if (token) {
    await db.user.updateMany({
      where: { sessionToken: token },
      data: { sessionToken: null, sessionTokenExpiry: null },
    });
  }
}
