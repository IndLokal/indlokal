import { type NextRequest, NextResponse } from 'next/server';
import { createSession, generateSessionToken, hashToken } from '@/lib/session';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  const rawToken = request.nextUrl.searchParams.get('token');

  if (!rawToken) {
    return NextResponse.redirect(new URL('/organizer/login?error=missing_token', request.url));
  }

  const tokenHash = await hashToken(rawToken);

  // Look up the one-time magic link token
  const magicLink = await db.magicLinkToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, role: true } } },
  });

  if (!magicLink || magicLink.user.role !== 'COMMUNITY_ADMIN') {
    return NextResponse.redirect(new URL('/organizer/login?error=invalid_token', request.url));
  }

  if (magicLink.usedAt) {
    return NextResponse.redirect(new URL('/organizer/login?error=invalid_token', request.url));
  }

  if (magicLink.expiresAt < new Date()) {
    return NextResponse.redirect(new URL('/organizer/login?error=expired_token', request.url));
  }

  // Mark the magic link as consumed so it cannot be replayed
  await db.magicLinkToken.update({
    where: { id: magicLink.id },
    data: { usedAt: new Date() },
  });

  // Issue a fresh session token (hashed in DB, raw in cookie)
  const sessionToken = generateSessionToken();
  await createSession(magicLink.user.id, sessionToken);

  return NextResponse.redirect(new URL('/organizer', request.url));
}
