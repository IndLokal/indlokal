/**
 * GET /auth/handoff — complete an app → web authenticated hand-off (TDD-0058).
 *
 * A signed-in mobile user opens this URL (with a one-time `token`) in an in-app
 * browser. We atomically consume the token, establish the standard secure
 * HttpOnly cookie session, and redirect to the validated `next` path so the
 * user lands authenticated instead of at a login wall.
 *
 * Flag-gated by AUTH_WEB_HANDOFF_ENABLED: when off the route 404s. Invalid,
 * expired, or already-used tokens redirect to /me/login?error=handoff with no
 * session established.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { createSession, generateSessionToken } from '@/lib/session';
import { captureServerEvent } from '@/lib/analytics/server';
import { Events } from '@/lib/analytics/events';
import { consumeWebHandoffToken } from '@/lib/auth/web-handoff';
import { FLAGS } from '@/lib/config/flags';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  if (!FLAGS.authWebHandoffEnabled) {
    return new NextResponse('Not found', { status: 404 });
  }

  const fail = (reason: string) => {
    // Log only a classified reason — never the raw token or user data.
    console.error('[auth/handoff] failed', { reason });
    return NextResponse.redirect(new URL('/me/login?error=handoff', request.url));
  };

  const token = request.nextUrl.searchParams.get('token');
  if (!token) return fail('missing');

  const consumed = await consumeWebHandoffToken(token);
  if (!consumed) return fail('invalid');

  // Normal session only — no roles granted here. Authorization stays controlled
  // by RoleAssignment / CommunityCollaborator and enforced on protected routes.
  const sessionToken = generateSessionToken();
  await createSession(consumed.userId, sessionToken);

  void captureServerEvent(consumed.userId, Events.USER_LOGGED_IN, {
    login_surface: 'web',
    auth_method: 'handoff',
  });

  return NextResponse.redirect(new URL(consumed.next, request.url));
}
