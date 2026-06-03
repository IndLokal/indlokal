import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generatePreviewToken } from '@/lib/preview-tokens';
import { getSessionUser } from '@/lib/session';
import { canEditCommunity } from '@/lib/auth/community-permissions';

export async function POST(request: Request, context: any) {
  // context.params may be a plain object or a Promise depending on runtime
  const resolvedParams = await (context.params instanceof Promise
    ? context.params
    : Promise.resolve(context.params));
  const { slug } = resolvedParams as { slug: string };
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(new URL('/organizer/login', request.url));

  const event = await db.event.findFirst({
    where: { slug },
    select: { id: true, communityId: true, createdByUserId: true },
  });
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const allowed = event.communityId
    ? canEditCommunity(user, event.communityId)
    : event.createdByUserId === user.id;
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const token = generatePreviewToken(event.id, 24);
  const url = new URL(`/events/preview/${slug}`, request.url);
  url.searchParams.set('token', token);
  // Redirect organizer to the preview link
  return NextResponse.redirect(url);
}
