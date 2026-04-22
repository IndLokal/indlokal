import { type NextRequest, NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/session';

export async function POST(_request: NextRequest) {
  await clearSessionCookie();
  return NextResponse.redirect(new URL('/organizer/login', _request.url));
}
