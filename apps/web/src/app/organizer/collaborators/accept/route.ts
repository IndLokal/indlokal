import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createSession, generateSessionToken, hashToken } from '@/lib/session';
import { db } from '@/lib/db';

const COLLAB_INVITE_TOKEN_COOKIE = 'collab_invite_token';
const COLLAB_INVITE_ID_COOKIE = 'collab_invite_id';

export async function GET(request: NextRequest) {
  const rawToken = request.nextUrl.searchParams.get('token') ?? '';
  const inviteId = request.nextUrl.searchParams.get('invite') ?? '';

  if (!rawToken || !inviteId) {
    return NextResponse.redirect(new URL('/organizer/login?error=invalid_invite', request.url));
  }

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charSet="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex,nofollow" />
    <title>Accept Collaborator Invite</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 0; background: #f8fafc; color: #0f172a; }
      .wrap { max-width: 520px; margin: 10vh auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; }
      h1 { margin: 0 0 12px; font-size: 1.25rem; }
      p { margin: 0 0 16px; color: #334155; }
      button { background: #0f766e; color: #fff; border: 0; border-radius: 8px; padding: 10px 14px; font-weight: 600; cursor: pointer; }
      small { display: block; margin-top: 12px; color: #64748b; }
    </style>
  </head>
  <body>
    <main class="wrap">
      <h1>Accept collaborator invite</h1>
      <p>Click below to activate your collaborator access and sign in.</p>
      <form method="POST" action="/organizer/collaborators/accept">
        <button type="submit">Accept invite and continue</button>
      </form>
      <small>This extra step prevents email scanners from auto-accepting your invite.</small>
    </main>
  </body>
</html>`;

  const response = new NextResponse(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store, no-cache, must-revalidate',
    },
  });

  response.cookies.set(COLLAB_INVITE_TOKEN_COOKIE, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/organizer/collaborators/accept',
    maxAge: 10 * 60,
  });

  response.cookies.set(COLLAB_INVITE_ID_COOKIE, inviteId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/organizer/collaborators/accept',
    maxAge: 10 * 60,
  });

  return response;
}

export async function POST(request: NextRequest) {
  const jar = await cookies();
  const rawToken = (jar.get(COLLAB_INVITE_TOKEN_COOKIE)?.value ?? '').trim();
  const inviteId = (jar.get(COLLAB_INVITE_ID_COOKIE)?.value ?? '').trim();

  jar.delete(COLLAB_INVITE_TOKEN_COOKIE);
  jar.delete(COLLAB_INVITE_ID_COOKIE);

  const seeOther = (path: string) =>
    NextResponse.redirect(new URL(path, request.url), { status: 303 });

  if (!rawToken || !inviteId) {
    return seeOther('/organizer/login?error=invalid_invite');
  }

  try {
    const tokenHash = await hashToken(rawToken);
    const now = new Date();

    const claim = await db.magicLinkToken.updateMany({
      where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });

    if (claim.count === 0) {
      return seeOther('/organizer/login?error=expired_token');
    }

    const magicLink = await db.magicLinkToken.findUnique({
      where: { tokenHash },
      select: { userId: true },
    });

    if (!magicLink?.userId) {
      return seeOther('/organizer/login?error=invalid_token');
    }

    const accepted = await db.$transaction(async (tx) => {
      const invite = await tx.communityCollaborator.findUnique({
        where: { id: inviteId },
        select: {
          id: true,
          userId: true,
          communityId: true,
          source: true,
          status: true,
        },
      });

      if (!invite) return false;
      if (invite.userId !== magicLink.userId) return false;
      if (invite.source !== 'COMMUNITY_ADMIN_INVITE') return false;
      if (invite.status !== 'PENDING') return false;

      await tx.communityCollaborator.update({
        where: { id: invite.id },
        data: {
          status: 'ACTIVE',
          reviewedAt: now,
          reviewedByUserId: magicLink.userId,
        },
      });

      await tx.contentLog.create({
        data: {
          entityType: 'community',
          entityId: invite.communityId,
          action: 'ROLE_GRANTED',
          changedBy: magicLink.userId,
          metadata: {
            targetUserId: magicLink.userId,
            via: 'collaborator_invite_accept',
          },
        },
      });

      return true;
    });

    if (!accepted) {
      return seeOther('/organizer/login?error=invalid_invite');
    }

    const sessionToken = generateSessionToken();
    await createSession(magicLink.userId, sessionToken);

    revalidatePath('/organizer');
    revalidatePath('/organizer/collaborators');

    return seeOther('/organizer?inviteAccepted=1');
  } catch {
    return seeOther('/organizer/login?error=server_error');
  }
}
