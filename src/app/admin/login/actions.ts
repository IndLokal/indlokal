'use server';

import { db } from '@/lib/db';
import { createMagicLinkToken } from '@/lib/session';
import { sendAdminMagicLinkEmail } from '@/lib/email';
import { checkRateLimit, magicLinkLimiter } from '@/lib/rate-limit';
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
