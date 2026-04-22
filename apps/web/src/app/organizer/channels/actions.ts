'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/session';
import type { ChannelType } from '@prisma/client';

const addChannelSchema = z.object({
  channelType: z.enum([
    'WHATSAPP',
    'TELEGRAM',
    'WEBSITE',
    'FACEBOOK',
    'INSTAGRAM',
    'EMAIL',
    'MEETUP',
    'YOUTUBE',
    'LINKEDIN',
    'OTHER',
  ]),
  url: z.string().url('Please enter a valid URL'),
  label: z.string().max(100).optional().or(z.literal('')),
  isPrimary: z.coerce.boolean().default(false),
});

export type ChannelResult =
  | { success: true }
  | { success: false; errors: Record<string, string[]> }
  | null;

export async function addChannel(_prev: ChannelResult, formData: FormData): Promise<ChannelResult> {
  const user = await getSessionUser();
  if (!user || user.claimedCommunities.length === 0) {
    return { success: false, errors: { _: ['Not authenticated'] } };
  }
  const community = user.claimedCommunities[0];

  const parsed = addChannelSchema.safeParse({
    channelType: formData.get('channelType'),
    url: formData.get('url'),
    label: formData.get('label') || '',
    isPrimary: formData.get('isPrimary') === 'true',
  });

  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { channelType, url, label, isPrimary } = parsed.data;

  // If setting as primary, demote others
  if (isPrimary) {
    await db.accessChannel.updateMany({
      where: { communityId: community.id },
      data: { isPrimary: false },
    });
  }

  await db.accessChannel.create({
    data: {
      communityId: community.id,
      channelType: channelType as ChannelType,
      url,
      label: label || null,
      isPrimary,
    },
  });

  revalidatePath('/organizer');
  revalidatePath(`/${community.city.slug}/communities/${community.slug}`);

  return { success: true };
}

export async function deleteChannel(formData: FormData) {
  const user = await getSessionUser();
  if (!user || user.claimedCommunities.length === 0) return;
  const community = user.claimedCommunities[0];

  const channelId = formData.get('channelId') as string;
  if (!channelId) return;

  // Verify the channel belongs to this community
  const channel = await db.accessChannel.findFirst({
    where: { id: channelId, communityId: community.id },
  });
  if (!channel) return;

  await db.accessChannel.delete({ where: { id: channelId } });

  revalidatePath('/organizer');
  revalidatePath('/organizer/channels');
  revalidatePath(`/${community.city.slug}/communities/${community.slug}`);
}
