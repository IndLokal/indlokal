import { type NextRequest, NextResponse } from 'next/server';
import { getSessionUser, setCurrentCommunityId } from '@/lib/session';

/**
 * POST /organizer/switch
 * Sets the active workspace community cookie and redirects back.
 * Body: communityId (form field)
 */
export async function POST(request: NextRequest) {
  const seeOther = (path: string) =>
    NextResponse.redirect(new URL(path, request.url), { status: 303 });

  const user = await getSessionUser();
  if (!user) return seeOther('/organizer/login');

  const formData = await request.formData();
  const communityId = String(formData.get('communityId') ?? '').trim();

  if (!communityId) return seeOther('/organizer');

  // Verify the community belongs to this user before setting the cookie
  const owned = user.claimedCommunities.some((c) => c.id === communityId);
  if (!owned) return seeOther('/organizer');

  await setCurrentCommunityId(communityId);

  // Honor a ?next= redirect param for deep links.
  // Normalize via URL parsing to prevent path-traversal (e.g. /organizer/../../admin).
  const nextParam = request.nextUrl.searchParams.get('next');
  let safePath = '/organizer';
  if (nextParam) {
    try {
      const resolved = new URL(nextParam, request.url);
      // Only allow same-origin paths that stay within /organizer
      if (
        resolved.origin === new URL(request.url).origin &&
        resolved.pathname.startsWith('/organizer') &&
        !resolved.pathname.includes('//')
      ) {
        safePath = resolved.pathname + resolved.search;
      }
    } catch {
      // malformed next param — fall back to /organizer
    }
  }

  return seeOther(safePath);
}
