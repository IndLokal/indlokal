import { type NextRequest, NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/session';

/**
 * POST /ambassador/logout - clears cookie + invalidates DB token, then
 * redirects to the public site.
 *
 * 303 See Other forces the browser to GET the destination.
 */
export async function POST(request: NextRequest) {
  await clearSessionCookie();
  return NextResponse.redirect(new URL('/', request.url), { status: 303 });
}
