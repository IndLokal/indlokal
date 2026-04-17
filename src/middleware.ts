import { NextResponse, type NextRequest } from 'next/server';

/**
 * Edge middleware — runs before every matched request.
 *
 * Responsibilities:
 * 1. Block common scanner/bot paths (/.git, /wp-admin, etc.)
 * 2. Validate origin on state-changing requests (CSRF defence-in-depth)
 */

const BLOCKED_PATHS = [
  '/.git',
  '/.env',
  '/wp-admin',
  '/wp-login',
  '/xmlrpc.php',
  '/phpmyadmin',
  '/admin.php',
];

const BLOCKED_PREFIXES = ['/.git/', '/.svn/', '/wp-', '/phpmyadmin/', '/cgi-bin/'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Block scanner paths — return 404 immediately
  if (
    BLOCKED_PATHS.includes(pathname) ||
    BLOCKED_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  ) {
    return new NextResponse(null, { status: 404 });
  }

  // 2. CSRF origin check for mutation requests to Route Handlers
  //    (Server Actions already have built-in origin checking in Next.js)
  if (request.method === 'POST' || request.method === 'PUT' || request.method === 'DELETE') {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');

    // Allow requests without origin header (same-origin form submissions, curl, etc.)
    // but block requests where origin is present and doesn't match host
    if (origin && host) {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        return new NextResponse('Forbidden', { status: 403 });
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  // Match all routes except static files and Next.js internals
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)'],
};
