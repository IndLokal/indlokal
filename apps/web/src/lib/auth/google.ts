/**
 * Server-only Google OAuth helpers — shared source of truth for Google
 * identity across both surfaces.
 *
 * - Mobile (`POST /api/v1/auth/google`) drives the OAuth dance, then exchanges
 *   the code here and receives the JWT `AuthTokens` envelope.
 * - Web (`/auth/google/start` + `/auth/google/callback`) drives a server-side
 *   redirect flow, exchanges the code here, and establishes the cookie session.
 *
 * Both paths share the SAME code-exchange and user upsert logic so a user is
 * created/linked identically regardless of surface (link by googleId first,
 * then by verified email). This module NEVER assigns roles or community
 * authority — normal login only authenticates the user.
 *
 * GOOGLE_CLIENT_SECRET is read here and never leaves the server.
 */

import type { City, User } from '@prisma/client';
import { db } from '@/lib/db';

/** Classified failure reasons — safe to log and to map to user-facing errors. */
export type GoogleAuthFailureReason =
  | 'not_configured'
  | 'exchange_failed'
  | 'profile_fetch_failed'
  | 'profile_incomplete';

export class GoogleAuthError extends Error {
  reason: GoogleAuthFailureReason;
  /** Optional non-sensitive provider error code (never the code/token itself). */
  providerError?: string;

  constructor(reason: GoogleAuthFailureReason, message: string, providerError?: string) {
    super(message);
    this.name = 'GoogleAuthError';
    this.reason = reason;
    this.providerError = providerError;
  }
}

type GoogleTokenResponse = {
  access_token?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleUserInfo = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

export type NormalizedGoogleProfile = {
  googleId: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
};

export type UserWithCityName = User & { city?: Pick<City, 'name'> | null };

/**
 * Resolve the configured Google OAuth credentials. Throws a classified
 * `GoogleAuthError` (not_configured) when either value is missing so callers
 * can log safely and surface a generic message.
 */
export function getGoogleOAuthConfig(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new GoogleAuthError('not_configured', 'google oauth not configured');
  }
  return { clientId, clientSecret };
}

/**
 * Exchange an authorization `code` for a Google access token. Server-only:
 * uses GOOGLE_CLIENT_SECRET. Returns the Google access token string.
 */
export async function exchangeGoogleCode(input: {
  code: string;
  redirectUri: string;
  codeVerifier?: string;
}): Promise<string> {
  const { clientId, clientSecret } = getGoogleOAuthConfig();

  const params = new URLSearchParams({
    code: input.code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: input.redirectUri,
    grant_type: 'authorization_code',
  });
  if (input.codeVerifier) params.set('code_verifier', input.codeVerifier);

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });

  const tokenJson = (await tokenRes.json().catch(() => ({}))) as GoogleTokenResponse;
  if (!tokenRes.ok || !tokenJson.access_token) {
    throw new GoogleAuthError(
      'exchange_failed',
      'google code exchange failed',
      tokenJson.error || undefined,
    );
  }
  return tokenJson.access_token;
}

/** Fetch and validate the Google userinfo profile from an access token. */
export async function fetchGoogleProfile(accessToken: string): Promise<NormalizedGoogleProfile> {
  const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!profileRes.ok) {
    throw new GoogleAuthError('profile_fetch_failed', 'google profile fetch failed');
  }

  const profile = (await profileRes.json().catch(() => ({}))) as GoogleUserInfo;
  if (!profile.sub || !profile.email) {
    throw new GoogleAuthError('profile_incomplete', 'google profile incomplete');
  }

  return {
    googleId: profile.sub,
    email: profile.email.toLowerCase(),
    emailVerified: profile.email_verified ?? false,
    name: profile.name ?? null,
    picture: profile.picture ?? null,
  };
}

/**
 * Create or link a User from a Google profile. Links by `googleId` first, then
 * by email. Authentication only — this NEVER writes `User.role`,
 * `RoleAssignment`, or community membership (authorization stays controlled by
 * RoleAssignment / CommunityCollaborator).
 *
 * Returns `{ user, isNewUser }`.
 */
export async function upsertGoogleUser(
  profile: NormalizedGoogleProfile,
): Promise<{ user: UserWithCityName; isNewUser: boolean }> {
  if (!profile.emailVerified) {
    throw new GoogleAuthError('profile_incomplete', 'google email not verified');
  }

  const existing = await db.user.findFirst({
    where: { OR: [{ googleId: profile.googleId }, { email: profile.email }] },
  });

  if (existing) {
    const user = await db.user.update({
      where: { id: existing.id },
      data: {
        googleId: profile.googleId,
        displayName: existing.displayName ?? profile.name,
        avatarUrl: existing.avatarUrl ?? profile.picture,
        lastActiveAt: new Date(),
      },
      include: { city: { select: { name: true } } },
    });
    return { user, isNewUser: false };
  }

  const user = await db.user.create({
    data: {
      email: profile.email,
      googleId: profile.googleId,
      displayName: profile.name,
      avatarUrl: profile.picture,
      lastActiveAt: new Date(),
    },
    include: { city: { select: { name: true } } },
  });
  return { user, isNewUser: true };
}
