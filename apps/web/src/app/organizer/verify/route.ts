import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createSession, generateSessionToken, hashToken } from '@/lib/session';
import { db } from '@/lib/db';

const ORGANIZER_VERIFY_TOKEN_COOKIE = 'organizer_verify_token';

// ADR-0008: organizer access is a community relationship, not a profile role.
// PLATFORM_ADMIN and the deferred EVENT_HOST role stay role-based.
const ORGANIZER_USER_SELECT = {
  id: true,
  role: true,
  claimedCommunities: { where: { claimState: 'CLAIMED' as const }, select: { id: true } },
  collaboratorMemberships: { where: { status: 'ACTIVE' as const }, select: { id: true } },
} as const;

type OrganizerEligibleUser = {
  role: string;
  claimedCommunities: { id: string }[];
  collaboratorMemberships: { id: string }[];
};

function isEligibleOrganizer(user: OrganizerEligibleUser | null | undefined): boolean {
  if (!user) return false;
  if (user.role === 'PLATFORM_ADMIN' || user.role === 'EVENT_HOST') return true;
  return user.claimedCommunities.length > 0 || user.collaboratorMemberships.length > 0;
}

export async function GET(request: NextRequest) {
  const rawToken = request.nextUrl.searchParams.get('token');

  if (!rawToken) {
    return NextResponse.redirect(new URL('/organizer/login?error=missing_token', request.url));
  }

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charSet="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex,nofollow" />
    <title>Confirm Organizer Login</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 0; background: #f8fafc; color: #0f172a; }
      .wrap { max-width: 480px; margin: 10vh auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; }
      h1 { margin: 0 0 12px; font-size: 1.25rem; }
      p { margin: 0 0 16px; color: #334155; }
      button { background: #0f766e; color: #fff; border: 0; border-radius: 8px; padding: 10px 14px; font-weight: 600; cursor: pointer; }
      small { display: block; margin-top: 12px; color: #64748b; }
    </style>
  </head>
  <body>
    <main class="wrap">
      <h1>Confirm organizer login</h1>
      <p>Click below to complete your one-time sign in.</p>
      <form method="POST" action="/organizer/verify">
        <button type="submit">Continue to organizer home</button>
      </form>
      <small>This extra step prevents email scanners from consuming your one-time link.</small>
    </main>
  </body>
</html>`;

  const response = new NextResponse(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store, no-cache, must-revalidate',
    },
  });

  response.cookies.set(ORGANIZER_VERIFY_TOKEN_COOKIE, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/organizer/verify',
    maxAge: 10 * 60,
  });

  return response;
}

export async function POST(request: NextRequest) {
  const jar = await cookies();
  const cookieToken = jar.get(ORGANIZER_VERIFY_TOKEN_COOKIE)?.value ?? '';
  const rawToken = cookieToken.trim();
  jar.delete(ORGANIZER_VERIFY_TOKEN_COOKIE);

  // POST→GET redirects must use 303 so the browser switches to GET on the
  // target URL. NextResponse.redirect() defaults to 307 which preserves the
  // method and would cause the destination page (GET-only) to 405.
  const seeOther = (path: string) =>
    NextResponse.redirect(new URL(path, request.url), { status: 303 });

  if (!rawToken) {
    return seeOther('/organizer/login?error=missing_token');
  }

  try {
    const tokenHash = await hashToken(rawToken);
    const now = new Date();
    const RECENT_USE_GRACE_MS = 2 * 60 * 1000;

    const claim = await db.magicLinkToken.updateMany({
      where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });

    if (claim.count === 0) {
      const existing = await db.magicLinkToken.findUnique({
        where: { tokenHash },
        include: { user: { select: ORGANIZER_USER_SELECT } },
      });

      if (!existing || !isEligibleOrganizer(existing.user)) {
        return seeOther('/organizer/login?error=invalid_token');
      }

      if (existing.expiresAt < now) {
        return seeOther('/organizer/login?error=expired_token');
      }

      if (existing.usedAt && now.getTime() - existing.usedAt.getTime() <= RECENT_USE_GRACE_MS) {
        const sessionToken = generateSessionToken();
        await createSession(existing.user.id, sessionToken);
        const dest = existing.user.role === 'EVENT_HOST' ? '/organizer/host' : '/organizer';
        return seeOther(dest);
      }

      return seeOther('/organizer/login?error=invalid_token');
    }

    const magicLink = await db.magicLinkToken.findUnique({
      where: { tokenHash },
      include: { user: { select: ORGANIZER_USER_SELECT } },
    });

    if (!magicLink || !isEligibleOrganizer(magicLink.user)) {
      return seeOther('/organizer/login?error=invalid_token');
    }

    // Issue a fresh session token (hashed in DB, raw in cookie)
    const sessionToken = generateSessionToken();
    await createSession(magicLink.user.id, sessionToken);

    const dest = magicLink.user.role === 'EVENT_HOST' ? '/organizer/host' : '/organizer';
    return seeOther(dest);
  } catch {
    return seeOther('/organizer/login?error=server_error');
  }
}
