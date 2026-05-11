/**
 * POST /api/v1/auth/magic-link/request — TDD-0001 §3.
 *
 * Issues an email-delivered magic link. To avoid account enumeration we
 * always return 200 OK with the same body, regardless of whether the
 * email matches an existing account.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth as authContracts } from '@indlokal/shared';
import { db } from '@/lib/db';
import { apiError } from '@/lib/api/error';
import { createMagicLinkToken } from '@/lib/session';
import { sendMagicLinkEmail } from '@/lib/email';
import {
  checkRateLimit,
  magicLinkLimiter,
  magicLinkIpLimiter,
  magicLinkGlobalLimiter,
  MAGIC_LINK_GLOBAL_KEY,
} from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('BAD_REQUEST', 'invalid JSON body');
  }

  const parsed = authContracts.MagicLinkRequest.safeParse(body);
  if (!parsed.success) {
    return apiError('BAD_REQUEST', 'invalid request', { details: parsed.error.flatten() });
  }

  const email = parsed.data.email.trim().toLowerCase();

  // IP + global caps first — bound abuse before any DB work.
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown';
  const ipRl = checkRateLimit(magicLinkIpLimiter, ip);
  if (!ipRl.allowed) {
    return apiError('RATE_LIMITED', 'too many magic-link requests from this source', {
      headers: { 'Retry-After': String(Math.ceil(ipRl.retryAfterMs / 1000)) },
    });
  }
  const globalRl = checkRateLimit(magicLinkGlobalLimiter, MAGIC_LINK_GLOBAL_KEY);
  if (!globalRl.allowed) {
    return apiError('RATE_LIMITED', 'magic-link service temporarily unavailable', {
      headers: { 'Retry-After': String(Math.ceil(globalRl.retryAfterMs / 1000)) },
    });
  }

  const rl = checkRateLimit(magicLinkLimiter, email);
  if (!rl.allowed) {
    return apiError('RATE_LIMITED', 'too many magic-link requests for this email', {
      headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) },
    });
  }

  // Best-effort send: if the user exists, mint a token and email it.
  // Always respond 200 so callers cannot enumerate accounts.
  try {
    const user = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (user) {
      const token = await createMagicLinkToken(user.id);
      // displayName at this stage is "your account" — the existing template
      // takes a community name; we pass the email so the email isn't blank.
      await sendMagicLinkEmail(email, token, email).catch((err) => {
        console.error('[auth/magic-link/request] email send failed', err);
      });
    }
  } catch (err) {
    console.error('[auth/magic-link/request] db error', err);
    // Fall through — always return 200 to prevent account enumeration.
  }

  return NextResponse.json({ ok: true } satisfies authContracts.MagicLinkRequestResponse);
}
