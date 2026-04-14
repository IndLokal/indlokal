import { type NextRequest, NextResponse } from 'next/server';
import { setSessionCookie } from '@/lib/session';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(new URL('/organizer/login?error=missing_token', request.url));
  }

  const user = await db.user.findUnique({
    where: { sessionToken: token },
    select: { id: true, sessionTokenExpiry: true, role: true },
  });

  if (!user || user.role !== 'COMMUNITY_ADMIN') {
    return NextResponse.redirect(new URL('/organizer/login?error=invalid_token', request.url));
  }

  if (!user.sessionTokenExpiry || user.sessionTokenExpiry < new Date()) {
    return NextResponse.redirect(new URL('/organizer/login?error=expired_token', request.url));
  }

  await setSessionCookie(token);

  return NextResponse.redirect(new URL('/organizer', request.url));
}
