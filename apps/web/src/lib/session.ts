import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { CollaboratorRole } from '@prisma/client';
import { db } from '@/lib/db';

const COOKIE_NAME = 'lp_session';

// One-time login links sent by email. Short-lived; single-use.
const MAGIC_LINK_TTL_HOURS = 24;

// How long a signed-in session stays valid without activity.
const SESSION_TTL_DAYS = 7;

// When a request comes in and the session expires within this window,
// extend it by another full SESSION_TTL_DAYS (sliding session).
const SESSION_REFRESH_THRESHOLD_HOURS = 24;

function sessionMaxAgeSeconds(): number {
  return SESSION_TTL_DAYS * 24 * 60 * 60;
}

/** Expiry timestamp for a magic-link token (one-time login link). */
export function tokenExpiry(): Date {
  const d = new Date();
  d.setHours(d.getHours() + MAGIC_LINK_TTL_HOURS);
  return d;
}

/** Expiry timestamp for a signed-in session. */
export function sessionExpiry(): Date {
  const d = new Date();
  d.setDate(d.getDate() + SESSION_TTL_DAYS);
  return d;
}

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
// (kept for backwards compatibility - magic-link callers use tokenExpiry above)

/** Create a one-time magic-link token and persist only its hash. */
export async function createMagicLinkToken(userId: string): Promise<string> {
  const rawToken = generateSessionToken();
  const tokenHash = await hashToken(rawToken);

  await db.magicLinkToken.create({
    data: {
      tokenHash,
      userId,
      expiresAt: tokenExpiry(),
    },
  });

  return rawToken;
}

/**
 * Persist a session: hash the raw token and store it in the DB, then set the raw token as a cookie.
 * Call this instead of writing sessionToken to the DB directly.
 */
export async function createSession(userId: string, rawToken: string) {
  const hashed = await hashToken(rawToken);
  await db.user.update({
    where: { id: userId },
    data: { sessionToken: hashed, sessionTokenExpiry: sessionExpiry() },
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
    maxAge: sessionMaxAgeSeconds(),
  });
}

/** Read the session cookie, hash it, and return the authenticated user or null */
export async function getSessionUser() {
  try {
    const jar = await cookies();
    const rawToken = jar.get(COOKIE_NAME)?.value;
    if (!rawToken) return null;

    const hashed = await hashToken(rawToken);

    const user = await db.user.findUnique({
      where: { sessionToken: hashed },
      include: {
        roleAssignments: {
          where: { revokedAt: null },
          select: { role: true, cityId: true, orgId: true, revokedAt: true },
        },
        claimedCommunities: {
          where: { claimState: 'CLAIMED' },
          include: {
            city: { select: { id: true, name: true, slug: true } },
            categories: { include: { category: true } },
            accessChannels: true,
          },
        },
        collaboratorMemberships: {
          where: { status: 'ACTIVE' },
          include: {
            community: {
              include: {
                city: { select: { id: true, name: true, slug: true } },
                categories: { include: { category: true } },
                accessChannels: true,
              },
            },
          },
        },
        savedCommunities: { select: { communityId: true } },
        savedEvents: { select: { eventId: true } },
      },
    });

    if (!user) return null;
    if (!user.sessionToken || !user.sessionTokenExpiry || user.sessionTokenExpiry < new Date())
      return null;

    // Sliding session: when the expiry is close, extend it transparently.
    // Failures here must not log the user out - swallow and continue.
    const msUntilExpiry = user.sessionTokenExpiry.getTime() - Date.now();
    if (msUntilExpiry < SESSION_REFRESH_THRESHOLD_HOURS * 60 * 60 * 1000) {
      try {
        const newExpiry = sessionExpiry();
        await db.user.update({
          where: { id: user.id },
          data: { sessionTokenExpiry: newExpiry },
        });
        // Re-set cookie with refreshed maxAge so the browser also extends.
        // Note: cookies().set() works in Server Components for Next 15+ via
        // the modified-cookies API; if it throws (read-only context), ignore.
        try {
          await setSessionCookie(rawToken);
        } catch {
          // best-effort - some render contexts forbid mutating cookies
        }
        user.sessionTokenExpiry = newExpiry;
      } catch {
        // best-effort
      }
    }

    const collaboratorCommunities = user.collaboratorMemberships.map((m) => m.community);
    const mergedClaimedCommunities = [...user.claimedCommunities];
    for (const community of collaboratorCommunities) {
      if (!mergedClaimedCommunities.some((existing) => existing.id === community.id)) {
        mergedClaimedCommunities.push(community);
      }
    }

    // ADR-0008 / TDD-0036: role-bearing community authority. Authorization
    // reads this (not User.role, not the workspace cookie). Includes a
    // mid-rollout fallback so claimed owners without a backfilled OWNER row
    // are still treated as OWNER.
    const communityMemberships: Array<{ communityId: string; role: CollaboratorRole }> =
      user.collaboratorMemberships.map((m) => ({ communityId: m.communityId, role: m.role }));
    for (const community of user.claimedCommunities) {
      if (!communityMemberships.some((m) => m.communityId === community.id)) {
        communityMemberships.push({ communityId: community.id, role: 'COMMUNITY_ADMIN' });
      }
    }

    return {
      ...user,
      claimedCommunities: mergedClaimedCommunities,
      communityMemberships,
    };
  } catch {
    // DB unreachable (e.g. Neon cold start) - treat as no session so the
    // page still renders instead of crashing on first request.
    return null;
  }
}

/** Require a valid session - redirect to login if missing */
export async function requireSessionUser() {
  const user = await getSessionUser();
  if (!user) redirect('/organizer/login');
  return user;
}

/** Require PLATFORM_ADMIN role - redirect to admin login if not authorized.
 * Preserved for backward-compat. New code should use requireCan() from
 * lib/auth/permissions.ts for granular, role-scoped checks.
 */
export async function requireAdmin() {
  const user = await getSessionUser();
  if (!user || user.role !== 'PLATFORM_ADMIN') redirect('/admin/login');
  return user;
}

/** Require COMMUNITY_ADMIN (organizer) - redirect if not authorized */
export async function requireCommunityAdmin() {
  const user = await getSessionUser();
  if (!user || (user.role !== 'COMMUNITY_ADMIN' && user.role !== 'PLATFORM_ADMIN'))
    redirect('/organizer/login');
  return user;
}

// ─────────────────────────────────────────────────────────────────────────────
// Workspace cookie - remembers which community is active for multi-org organizers
// ─────────────────────────────────────────────────────────────────────────────

const COMMUNITY_COOKIE = 'lp_community';

/** Return the currently-selected communityId from the workspace cookie, or null */
export async function getCurrentCommunityId(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(COMMUNITY_COOKIE)?.value ?? null;
}

/** Persist the active community in a short-lived cookie scoped to /organizer */
export async function setCurrentCommunityId(communityId: string) {
  const jar = await cookies();
  jar.set(COMMUNITY_COOKIE, communityId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/organizer',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

/** Clear the community workspace cookie */
export async function clearCurrentCommunityId() {
  const jar = await cookies();
  jar.delete(COMMUNITY_COOKIE);
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
