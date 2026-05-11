'use server';

import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { createMagicLinkToken } from '@/lib/session';
import { sendMagicLinkEmail } from '@/lib/email';
import {
  checkRateLimit,
  magicLinkLimiter,
  magicLinkIpLimiter,
  magicLinkGlobalLimiter,
  MAGIC_LINK_GLOBAL_KEY,
} from '@/lib/rate-limit';
import { z } from 'zod';

const emailSchema = z.string().email();

export type LoginResult =
  | { success: true; communityName: string }
  | { success: false; error: string }
  | null;

export async function requestMagicLink(
  _prev: LoginResult,
  formData: FormData,
): Promise<LoginResult> {
  const email = (formData.get('email') as string)?.trim().toLowerCase();

  if (!email || !emailSchema.safeParse(email).success) {
    return { success: false, error: 'Please enter a valid email address.' };
  }

  // IP + global checks before any DB work — caps abuse from a single
  // source and bounds total Resend spend across all callers.
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const ipRl = checkRateLimit(magicLinkIpLimiter, ip);
  const globalRl = checkRateLimit(magicLinkGlobalLimiter, MAGIC_LINK_GLOBAL_KEY);
  if (!ipRl.allowed || !globalRl.allowed) {
    return {
      success: false,
      error: 'Too many login requests. Please wait before retrying.',
    };
  }

  let user: {
    id: string;
    email: string;
    role: string;
    claimedCommunities: { name: string }[];
  } | null = null;
  try {
    user = await db.user.findUnique({
      where: { email },
      include: {
        claimedCommunities: {
          where: { claimState: 'CLAIMED' },
          select: { name: true },
        },
      },
    });
  } catch {
    return { success: false, error: 'Something went wrong. Please try again.' };
  }

  if (!user || user.role !== 'COMMUNITY_ADMIN') {
    // Vague error to prevent email enumeration
    return {
      success: false,
      error:
        'No organizer account found for that email. Have you claimed a community and been approved?',
    };
  }

  if (user.claimedCommunities.length === 0) {
    return {
      success: false,
      error: 'Your account exists but has no approved community claim yet.',
    };
  }

  // Rate limit by email address
  const rl = checkRateLimit(magicLinkLimiter, email);
  if (!rl.allowed) {
    return {
      success: false,
      error: 'Too many login requests. Please check your email or wait before retrying.',
    };
  }

  // Generate a one-time magic link token (separate from session token)
  const rawToken = await createMagicLinkToken(user.id);

  try {
    await sendMagicLinkEmail(user.email, rawToken, user.claimedCommunities[0].name);
  } catch {
    return { success: false, error: 'Failed to send login email. Please try again.' };
  }

  return {
    success: true,
    communityName: user.claimedCommunities[0].name,
  };
}
