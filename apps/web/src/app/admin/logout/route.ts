import { type NextRequest, NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/session';

/**
 * POST /admin/logout — clears cookie + invalidates DB token, then redirects
 * to the admin login page with a friendly notice.
 *
 * 303 See Other forces the browser to GET the destination (the login page is
 * a GET-only route).
 */
export async function POST(request: NextRequest) {
  await clearSessionCookie();
  return NextResponse.redirect(new URL('/admin/login?signed_out=1', request.url), {
    status: 303,
  });
}
