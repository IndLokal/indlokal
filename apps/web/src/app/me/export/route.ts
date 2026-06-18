import { NextResponse, type NextRequest } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { buildMeDataExport } from '@/lib/auth/me-export';

export const runtime = 'nodejs';

function exportFileName(now: Date = new Date()): string {
  const isoDate = now.toISOString().slice(0, 10);
  return `indlokal-me-export-${isoDate}.json`;
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.redirect(new URL('/me/login', req.url));
  }

  const parsed = await buildMeDataExport(user.id, 'WEB_ME_PAGE');
  if (!parsed) {
    return NextResponse.redirect(new URL('/me/login', req.url));
  }

  return new NextResponse(JSON.stringify(parsed, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${exportFileName()}"`,
      'Cache-Control': 'no-store',
    },
  });
}
