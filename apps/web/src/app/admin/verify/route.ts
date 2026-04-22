import { type NextRequest, NextResponse } from 'next/server';
import { createSession, generateSessionToken, hashToken } from '@/lib/session';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  const rawToken = request.nextUrl.searchParams.get('token');

  if (!rawToken) {
    return NextResponse.redirect(new URL('/admin/login?error=missing_token', request.url));
  }

  const tokenHash = await hashToken(rawToken);

  const magicLink = await db.magicLinkToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, role: true } } },
  });

  if (!magicLink || magicLink.user.role !== 'PLATFORM_ADMIN') {
    return NextResponse.redirect(new URL('/admin/login?error=invalid_token', request.url));
  }

  if (magicLink.usedAt) {
    return NextResponse.redirect(new URL('/admin/login?error=invalid_token', request.url));
  }

  if (magicLink.expiresAt < new Date()) {
    return NextResponse.redirect(new URL('/admin/login?error=expired_token', request.url));
  }

  await db.magicLinkToken.update({
    where: { id: magicLink.id },
    data: { usedAt: new Date() },
  });

  const sessionToken = generateSessionToken();
  await createSession(magicLink.user.id, sessionToken);

  return NextResponse.redirect(new URL('/admin', request.url));
}
