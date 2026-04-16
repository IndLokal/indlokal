'use server';

import { db } from '@/lib/db';
import { generateSessionToken, tokenExpiry } from '@/lib/session';
import { sendMagicLinkEmail } from '@/lib/email';
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
