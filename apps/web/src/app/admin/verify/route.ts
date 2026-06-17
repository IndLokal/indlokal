import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  createSession,
  generateSessionToken,
  hashToken,
  setSessionCookieOnResponse,
} from '@/lib/session';
import { db } from '@/lib/db';
import { captureServerEvent } from '@/lib/analytics/server';
import { Events } from '@/lib/analytics/events';

const ADMIN_VERIFY_TOKEN_COOKIE = 'admin_verify_token';
const RECENT_USE_GRACE_MS = 2 * 60 * 1000;

const CONFIRM_ADMIN_LOGIN_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charSet="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex,nofollow" />
    <title>Confirm Admin Login</title>
    <style>
      body {
        font-family: system-ui, sans-serif;
        margin: 0;
        background: #f8fafc;
        color: #0f172a;
      }

      .wrap {
        max-width: 480px;
        margin: 10vh auto;
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 24px;
      }

      h1 {
        margin: 0 0 12px;
        font-size: 1.25rem;
      }

      p {
        margin: 0 0 16px;
        color: #334155;
      }

      button {
        background: #0f766e;
        color: #fff;
        border: 0;
        border-radius: 8px;
        padding: 10px 14px;
        font-weight: 600;
        cursor: pointer;
      }

      small {
        display: block;
        margin-top: 12px;
        color: #64748b;
      }
    </style>
  </head>
  <body>
    <main class="wrap">
      <h1>Confirm admin login</h1>
      <p>Click below to complete your one-time sign in.</p>
      <form method="POST" action="/admin/verify">
        <button type="submit">Continue to admin dashboard</button>
      </form>
      <small>This extra step prevents email scanners from consuming your one-time link.</small>
    </main>
  </body>
</html>`;

function seeOther(path: string, request: NextRequest): NextResponse {
  return NextResponse.redirect(new URL(path, request.url), {
    status: 303,
  });
}

function redirectAndClearVerifyCookie(
  path: string,
  request: NextRequest,
): NextResponse {
  const response = seeOther(path, request);

  response.cookies.delete(ADMIN_VERIFY_TOKEN_COOKIE);

  return response;
}

async function createAdminSessionResponse(
  userId: string,
  request: NextRequest,
): Promise<NextResponse> {
  const sessionToken = generateSessionToken();

  await createSession(userId, sessionToken);

  void captureServerEvent(userId, Events.USER_LOGGED_IN, {
    login_surface: 'admin_web',
    auth_method: 'magic_link',
  });

  const response = seeOther('/admin', request);

  setSessionCookieOnResponse(response, sessionToken);
  response.cookies.delete(ADMIN_VERIFY_TOKEN_COOKIE);

  return response;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const rawToken = request.nextUrl.searchParams.get('token')?.trim();

  if (!rawToken) {
    return NextResponse.redirect(
      new URL('/admin/login?error=missing_token', request.url),
    );
  }

  const response = new NextResponse(CONFIRM_ADMIN_LOGIN_HTML, {
    headers: {
      'cache-control': 'no-store, no-cache, must-revalidate',
      'content-security-policy':
        "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      'content-type': 'text/html; charset=utf-8',
      'x-content-type-options': 'nosniff',
    },
  });

  response.cookies.set(ADMIN_VERIFY_TOKEN_COOKIE, rawToken, {
    httpOnly: true,
    maxAge: 10 * 60,
    path: '/admin/verify',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  return response;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const jar = await cookies();
  const rawToken = jar.get(ADMIN_VERIFY_TOKEN_COOKIE)?.value?.trim() ?? '';

  if (!rawToken) {
    return redirectAndClearVerifyCookie(
      '/admin/login?error=missing_token',
      request,
    );
  }

  const tokenHash = await hashToken(rawToken);
  const now = new Date();

  const claim = await db.magicLinkToken.updateMany({
    data: {
      usedAt: now,
    },
    where: {
      expiresAt: {
        gt: now,
      },
      tokenHash,
      usedAt: null,
    },
  });

  if (claim.count === 0) {
    const existing = await db.magicLinkToken.findUnique({
      include: {
        user: {
          select: {
            id: true,
            role: true,
          },
        },
      },
      where: {
        tokenHash,
      },
    });

    if (!existing || existing.user.role !== 'PLATFORM_ADMIN') {
      return redirectAndClearVerifyCookie(
        '/admin/login?error=invalid_token',
        request,
      );
    }

    if (existing.expiresAt < now) {
      return redirectAndClearVerifyCookie(
        '/admin/login?error=expired_token',
        request,
      );
    }

    if (
      existing.usedAt &&
      now.getTime() - existing.usedAt.getTime() <= RECENT_USE_GRACE_MS
    ) {
      return createAdminSessionResponse(existing.user.id, request);
    }

    return redirectAndClearVerifyCookie(
      '/admin/login?error=invalid_token',
      request,
    );
  }

  const magicLink = await db.magicLinkToken.findUnique({
    include: {
      user: {
        select: {
          id: true,
          role: true,
        },
      },
    },
    where: {
      tokenHash,
    },
  });

  if (!magicLink || magicLink.user.role !== 'PLATFORM_ADMIN') {
    return redirectAndClearVerifyCookie(
      '/admin/login?error=invalid_token',
      request,
    );
  }

  return createAdminSessionResponse(magicLink.user.id, request);
}
