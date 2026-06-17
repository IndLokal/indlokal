'use server';

import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { createMagicLinkToken } from '@/lib/session';
import { sendAdminMagicLinkEmail } from '@/lib/email';
import {
  checkRateLimit,
  magicLinkLimiter,
  magicLinkIpLimiter,
  magicLinkGlobalLimiter,
  MAGIC_LINK_GLOBAL_KEY,
} from '@/lib/rate-limit';
import { z } from 'zod';

const emailSchema = z.string().email();

function deriveRequestOrigin(headersList: Headers): string | null {
  const forwardedHost = headersList.get('x-forwarded-host')?.split(',')[0]?.trim().toLowerCase();
  const host = forwardedHost || headersList.get('host')?.split(',')[0]?.trim().toLowerCase();

  if (!host) return null;

  const forwardedProto = headersList.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase();
  const proto =
    forwardedProto ||
    (host.includes('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');

  return `${proto}://${host}`;
}

export type AdminLoginResult = { success: true } | { success: false; error: string } | null;

export async function requestAdminMagicLink(
  _prev: AdminLoginResult,
  formData: FormData,
): Promise<AdminLoginResult> {
  const email = (formData.get('email') as string)?.trim().toLowerCase();

  if (!email || !emailSchema.safeParse(email).success) {
    return { success: false, error: 'Please enter a valid email address.' };
  }

  // IP + global checks first - before any DB work - so unbounded probes
  // can't even reach the user lookup. Use a deliberately vague error so
  // the response shape doesn't reveal which limit fired.
  const requestHeaders = await headers();
  const ip = requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const ipRl = checkRateLimit(magicLinkIpLimiter, ip);
  const globalRl = checkRateLimit(magicLinkGlobalLimiter, MAGIC_LINK_GLOBAL_KEY);
  if (!ipRl.allowed || !globalRl.allowed) {
    return {
      success: false,
      error: 'Too many login requests. Please wait before retrying.',
    };
  }

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });

  if (!user || user.role !== 'PLATFORM_ADMIN') {
    // Vague message to prevent email enumeration
    return { success: false, error: 'No admin account found for that email.' };
  }

  const rl = checkRateLimit(magicLinkLimiter, email);
  if (!rl.allowed) {
    return {
      success: false,
      error: 'Too many login requests. Please check your email or wait before retrying.',
    };
  }

  const rawToken = await createMagicLinkToken(user.id);
  const requestOrigin = deriveRequestOrigin(requestHeaders);
  const verifyUrlOverride = requestOrigin
    ? `${requestOrigin}/admin/verify?token=${encodeURIComponent(rawToken)}`
    : undefined;

  try {
    await sendAdminMagicLinkEmail(email, rawToken, verifyUrlOverride);
  } catch {
    return { success: false, error: 'Failed to send login email. Please try again.' };
  }

  return { success: true };
}
