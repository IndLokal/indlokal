'use server';

import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { createMagicLinkToken } from '@/lib/session';
import { sendMagicLinkEmail } from '@/lib/email';
import { captureServerEvent } from '@/lib/analytics/server';
import { Events } from '@/lib/analytics/events';
import {
  checkRateLimit,
  magicLinkLimiter,
  magicLinkIpLimiter,
  magicLinkGlobalLimiter,
  MAGIC_LINK_GLOBAL_KEY,
} from '@/lib/rate-limit';
import { z } from 'zod';

const hostStartSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(2).max(100),
  cityId: z.string().min(1),
  link1: z.string().url().optional().or(z.literal('')),
  link2: z.string().url().optional().or(z.literal('')),
});

export type HostStartResult =
  | { success: true; email: string }
  | { success: false; error: string }
  | null;

export async function hostSignUp(
  _prev: HostStartResult,
  formData: FormData,
): Promise<HostStartResult> {
  const raw = {
    email: (formData.get('email') as string)?.trim().toLowerCase(),
    displayName: (formData.get('displayName') as string)?.trim(),
    cityId: formData.get('cityId') as string,
    link1: (formData.get('link1') as string) || '',
    link2: (formData.get('link2') as string) || '',
  };

  const parsed = hostStartSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: 'Please fill in all required fields correctly.' };
  }

  const { email, displayName, cityId, link1, link2 } = parsed.data;

  // City is the discovery partition key — verify the submitted id resolves to
  // a real, active city before attaching it to the host's profile.
  const cityExists = await db.city.findFirst({
    where: { id: cityId, isActive: true },
    select: { id: true },
  });
  if (!cityExists) {
    return { success: false, error: 'Please select a valid city.' };
  }

  // Rate limits
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const ipRl = checkRateLimit(magicLinkIpLimiter, ip);
  const globalRl = checkRateLimit(magicLinkGlobalLimiter, MAGIC_LINK_GLOBAL_KEY);
  if (!ipRl.allowed || !globalRl.allowed) {
    return { success: false, error: 'Too many requests. Please wait before retrying.' };
  }

  const rl = checkRateLimit(magicLinkLimiter, email);
  if (!rl.allowed) {
    return { success: false, error: 'Too many login requests. Please check your email or wait.' };
  }

  // Upsert user: if they already have an account, upgrade role to EVENT_HOST if not already an organizer
  const links = [link1, link2].filter(Boolean) as string[];
  const hostProfile = { displayName, cityId, links };
  let wasCreated = false;

  let user = await db.user.findUnique({ where: { email } });
  if (user) {
    // Don't downgrade an existing COMMUNITY_ADMIN or PLATFORM_ADMIN
    const canUpgrade = user.role === 'USER' || user.role === 'EVENT_HOST';
    await db.user.update({
      where: { id: user.id },
      data: {
        displayName: user.displayName ?? displayName,
        cityId: user.cityId ?? cityId,
        ...(canUpgrade ? { role: 'EVENT_HOST' } : {}),
        metadata: {
          ...(typeof user.metadata === 'object' && user.metadata !== null
            ? (user.metadata as object)
            : {}),
          hostProfile,
        },
      },
    });
  } else {
    user = await db.user.create({
      data: {
        email,
        displayName,
        cityId,
        role: 'EVENT_HOST',
        metadata: { hostProfile },
      },
    });
    wasCreated = true;
  }

  const rawToken = await createMagicLinkToken(user.id);

  try {
    await sendMagicLinkEmail(user.email, rawToken, displayName);
  } catch {
    return { success: false, error: 'Failed to send login email. Please try again.' };
  }

  if (wasCreated) {
    void captureServerEvent(user.id, Events.USER_SIGNED_UP, {
      signup_surface: 'host_start',
      role: 'event_host',
    });
  }

  return { success: true, email };
}
