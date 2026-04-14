'use server';

import { db } from '@/lib/db';
import { claimCommunitySchema } from '@/lib/validation';

export type ClaimResult =
  | { success: true }
  | { success: false; errors: Record<string, string[]> }
  | null;

export async function claimCommunity(_prev: ClaimResult, formData: FormData): Promise<ClaimResult> {
  const raw = {
    communityId: formData.get('communityId') as string,
    email: formData.get('email') as string,
    name: formData.get('name') as string,
    relationship: formData.get('relationship') as string,
    message: (formData.get('message') as string) || '',
    whatsappUrl: (formData.get('whatsappUrl') as string) || '',
    telegramUrl: (formData.get('telegramUrl') as string) || '',
    socialUrl: (formData.get('socialUrl') as string) || '',
  };

  const parsed = claimCommunitySchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const data = parsed.data;

  // Verify community exists and is claimable
  const community = await db.community.findUnique({
    where: { id: data.communityId },
    select: { id: true, claimState: true },
  });

  if (!community) {
    return { success: false, errors: { communityId: ['Community not found'] } };
  }

  if (community.claimState !== 'UNCLAIMED') {
    return {
      success: false,
      errors: { communityId: ['This community already has a pending or approved claim'] },
    };
  }

  // Find or create user
  let user = await db.user.findUnique({ where: { email: data.email } });
  if (!user) {
    user = await db.user.create({
      data: {
        email: data.email,
        displayName: data.name,
        role: 'USER',
      },
    });
  }

  // Update community claim state
  await db.community.update({
    where: { id: data.communityId },
    data: {
      claimState: 'CLAIM_PENDING',
      claimedByUserId: user.id,
      metadata: {
        claimRequest: {
          relationship: data.relationship,
          message: data.message,
          whatsappUrl: data.whatsappUrl || undefined,
          telegramUrl: data.telegramUrl || undefined,
          socialUrl: data.socialUrl || undefined,
          requestedAt: new Date().toISOString(),
        },
      },
    },
  });

  // Record trust signal
  await db.trustSignal.create({
    data: {
      entityType: 'COMMUNITY',
      communityId: data.communityId,
      signalType: 'COMMUNITY_CLAIMED',
      createdBy: user.id,
    },
  });

  return { success: true };
}
