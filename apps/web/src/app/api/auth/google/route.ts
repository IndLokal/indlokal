import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * GET /api/auth/google
 * Initiates Google OAuth flow — generates CSRF state and redirects to Google.
 */
export async function GET() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    // Google OAuth not configured — redirect to the login page with an informative error
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'}/me/login?error=not_configured`,
    );
  }

  const state = crypto.randomUUID();

  const jar = await cookies();
  jar.set('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600, // 10 minutes
  });

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}
