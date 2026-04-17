import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { generateSessionToken, createSession } from '@/lib/session';
import { captureServerEvent } from '@/lib/posthog';
import { Events } from '@/lib/analytics-events';

const BASE = process.env.NEXT_PUBLIC_APP_URL!;

/**
 * GET /api/auth/google/callback
 * Handles Google OAuth callback: validates state, exchanges code, upserts user, sets session.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  const jar = await cookies();
  const storedState = jar.get('oauth_state')?.value;
  jar.delete('oauth_state');

  // CSRF validation
  if (!code || !state || state !== storedState) {
    return NextResponse.redirect(`${BASE}/me/login?error=oauth`);
  }

  // Exchange code for access token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${BASE}/api/auth/google/callback`,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${BASE}/me/login?error=oauth`);
  }

  const { access_token } = (await tokenRes.json()) as { access_token: string };

  // Fetch Google user profile
  const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  if (!profileRes.ok) {
    return NextResponse.redirect(`${BASE}/me/login?error=oauth`);
  }

  const profile = (await profileRes.json()) as {
    sub: string;
    email: string;
    name?: string;
    picture?: string;
  };

  const rawToken = generateSessionToken();

  // Find existing account by googleId or email (link accounts, no duplicates)
  const existing = await db.user.findFirst({
    where: { OR: [{ googleId: profile.sub }, { email: profile.email }] },
    select: { id: true },
  });

  let userId: string;
  let isNewUser: boolean;

  if (existing) {
    isNewUser = false;
    userId = existing.id;
    await db.user.update({
      where: { id: existing.id },
      data: {
        googleId: profile.sub,
        displayName: profile.name ?? undefined,
        avatarUrl: profile.picture ?? undefined,
        lastActiveAt: new Date(),
      },
    });
  } else {
    isNewUser = true;
    const created = await db.user.create({
      data: {
        googleId: profile.sub,
        email: profile.email,
        displayName: profile.name ?? null,
        avatarUrl: profile.picture ?? null,
      },
      select: { id: true },
    });
    userId = created.id;
  }

  await createSession(userId, rawToken);

  // Fire analytics event — identify the user and record signup vs login
  if (isNewUser) {
    await captureServerEvent(userId, Events.USER_SIGNED_UP, { auth_provider: 'google' });
  } else {
    await captureServerEvent(userId, Events.USER_LOGGED_IN, { auth_provider: 'google' });
  }

  return NextResponse.redirect(`${BASE}/me`);
}
