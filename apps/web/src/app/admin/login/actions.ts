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

export type AdminLoginResult = { success: true } | { success: false; error: string } | null;

export async function requestAdminMagicLink(
  _prev: AdminLoginResult,
  formData: FormData,
): Promise<AdminLoginResult> {
  const email = (formData.get('email') as string)?.trim().toLowerCase();

  if (!email || !emailSchema.safeParse(email).success) {
    return { success: false, error: 'Please enter a valid email address.' };
  }

  // IP + global checks first — before any DB work — so unbounded probes
  // can't even reach the user lookup. Use a deliberately vague error so
  // the response shape doesn't reveal which limit fired.
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
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

  try {
    await sendAdminMagicLinkEmail(email, rawToken);
  } catch {
    return { success: false, error: 'Failed to send login email. Please try again.' };
  }

  return { success: true };
}
