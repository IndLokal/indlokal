import { type NextRequest, NextResponse } from 'next/server';
import { createSession, generateSessionToken, hashToken } from '@/lib/session';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  const rawToken = request.nextUrl.searchParams.get('token');

  if (!rawToken) {
    return NextResponse.redirect(new URL('/admin/login?error=missing_token', request.url));
  }

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charSet="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex,nofollow" />
    <title>Confirm Admin Login</title>
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
      <h1>Confirm admin login</h1>
      <p>Click below to complete your one-time sign in.</p>
      <form method="POST" action="/admin/verify">
        <input type="hidden" name="token" value="${rawToken}" />
        <button type="submit">Continue to admin dashboard</button>
      </form>
      <small>This extra step prevents email scanners from consuming your one-time link.</small>
    </main>
  </body>
</html>`;

  return new NextResponse(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store, no-cache, must-revalidate',
    },
  });
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const rawToken = String(formData.get('token') ?? '').trim();

  if (!rawToken) {
    return NextResponse.redirect(new URL('/admin/login?error=missing_token', request.url));
  }

  const tokenHash = await hashToken(rawToken);

  const claim = await db.magicLinkToken.updateMany({
    where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });

  if (claim.count === 0) {
    return NextResponse.redirect(new URL('/admin/login?error=invalid_token', request.url));
  }

  const magicLink = await db.magicLinkToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, role: true } } },
  });

  if (!magicLink || magicLink.user.role !== 'PLATFORM_ADMIN') {
    return NextResponse.redirect(new URL('/admin/login?error=invalid_token', request.url));
  }

  const sessionToken = generateSessionToken();
  await createSession(magicLink.user.id, sessionToken);

  return NextResponse.redirect(new URL('/admin', request.url));
}
