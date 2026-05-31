'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { communityOptions } from '@indlokal/shared';
import { db } from '@/lib/db';
import { getSessionUser, getCurrentCommunityId } from '@/lib/session';
import { withAction } from '@/lib/api/handlers';
import { canEditCommunity } from '@/lib/auth/community-permissions';
import {
  resolveActiveOrganizerCommunity,
  type OrganizerSessionCommunity,
} from '@/lib/organizer/workspace';

const addChannelSchema = z.object({
  channelType: z.enum(communityOptions.CHANNEL_TYPE_VALUES),
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
  const currentId = await getCurrentCommunityId();
  const community = resolveActiveOrganizerCommunity<OrganizerSessionCommunity>(
    user.claimedCommunities,
    currentId,
  );

  if (!community) {
    return { success: false, errors: { _: ['No active community found.'] } };
  }

  // ADR-0008: enforce per-community authority on the backend, not the cookie.
  if (!canEditCommunity(user, community.id)) {
    return {
      success: false,
      errors: { _: ['You do not have permission to edit this community.'] },
    };
  }

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

  return withAction(
    async () => {
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
          channelType,
          url,
          label: label || null,
          isPrimary,
        },
      });

      revalidatePath('/organizer');
      revalidatePath('/organizer/links');
      revalidatePath(`/${community.city.slug}/communities/${community.slug}`);

      return { success: true } as ChannelResult;
    },
    () => ({ success: false, errors: { _: ['Something went wrong. Please try again.'] } }),
  );
}

export async function deleteChannel(formData: FormData) {
  const user = await getSessionUser();
  if (!user || user.claimedCommunities.length === 0) return;
  const currentId = await getCurrentCommunityId();
  const community = resolveActiveOrganizerCommunity<OrganizerSessionCommunity>(
    user.claimedCommunities,
    currentId,
  );
  if (!community) return;

  // ADR-0008: enforce per-community authority on the backend, not the cookie.
  if (!canEditCommunity(user, community.id)) return;

  const channelId = formData.get('channelId') as string;
  if (!channelId) return;

  return withAction(
    async () => {
      // Verify the channel belongs to this community
      const channel = await db.accessChannel.findFirst({
        where: { id: channelId, communityId: community.id },
      });
      if (!channel) return;

      await db.accessChannel.delete({ where: { id: channelId } });

      revalidatePath('/organizer');
      revalidatePath('/organizer/links');
      revalidatePath(`/${community.city.slug}/communities/${community.slug}`);
    },
    () => undefined,
  );
}
