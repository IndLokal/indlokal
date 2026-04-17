'use server';

import { db } from '@/lib/db';
import { generateSessionToken, tokenExpiry } from '@/lib/session';
import { sendMagicLinkEmail } from '@/lib/email';
import { z } from 'zod';

const emailSchema = z.string().email();

// TOKEN_TTL_HOURS must match the value in session.ts
const TOKEN_TTL_HOURS = 24;
const MAGIC_LINK_COOLDOWN_MS = 60 * 1000; // 1 minute between requests

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

  const user = await db.user.findUnique({
    where: { email },
    include: {
      claimedCommunities: {
        where: { claimState: 'CLAIMED' },
        select: { name: true },
      },
    },
  });

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

  // Rate limit: derive when the last token was issued from its expiry time
  if (user.sessionTokenExpiry) {
    const issuedAt = new Date(user.sessionTokenExpiry.getTime() - TOKEN_TTL_HOURS * 60 * 60 * 1000);
    if (Date.now() - issuedAt.getTime() < MAGIC_LINK_COOLDOWN_MS) {
      return {
        success: false,
        error:
          'A login link was just sent. Please check your email or wait a moment before retrying.',
      };
    }
  }

  const token = generateSessionToken();
  await db.user.update({
    where: { id: user.id },
    data: { sessionToken: token, sessionTokenExpiry: tokenExpiry() },
  });

  try {
    await sendMagicLinkEmail(user.email, token, user.claimedCommunities[0].name);
  } catch {
    return { success: false, error: 'Failed to send login email. Please try again.' };
  }

  return {
    success: true,
    communityName: user.claimedCommunities[0].name,
  };
}
