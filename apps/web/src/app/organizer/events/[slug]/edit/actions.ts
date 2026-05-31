'use server';

import { revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getCurrentCommunityId, getSessionUser } from '@/lib/session';
import { withAction } from '@/lib/api/handlers';
import { canEditCommunity } from '@/lib/auth/community-permissions';
import {
  resolveActiveOrganizerCommunity,
  type OrganizerSessionCommunity,
} from '@/lib/organizer/workspace';

const editEventSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(5000).optional().or(z.literal('')),
  startsAt: z
    .string()
    .min(1, 'Start date is required')
    .refine((v) => !isNaN(Date.parse(v)), { message: 'Invalid start date' }),
  endsAt: z
    .string()
    .min(1, 'End date is required')
    .refine((v) => !isNaN(Date.parse(v)), { message: 'Invalid end date' }),
  venueName: z.string().max(200).optional().or(z.literal('')),
  venueAddress: z.string().max(500).optional().or(z.literal('')),
  isOnline: z.coerce.boolean().default(false),
  onlineLink: z.string().url().optional().or(z.literal('')),
  imageUrl: z.string().url().optional().or(z.literal('')),
  registrationUrl: z.string().url().optional().or(z.literal('')),
  cost: z.enum(['free', 'paid', 'unclear']).default('free'),
});

export type EditEventResult =
  | { success: true }
  | { success: false; errors: Record<string, string[]> }
  | null;

export async function editEvent(
  _prev: EditEventResult,
  formData: FormData,
): Promise<EditEventResult> {
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

  if (!canEditCommunity(user, community.id)) {
    return {
      success: false,
      errors: { _: ['You do not have permission to edit events for this community.'] },
    };
  }

  const slug = formData.get('slug') as string;
  const existing = await db.event.findFirst({
    where: { slug, communityId: community.id },
    select: { id: true },
  });

  if (!existing) {
    return { success: false, errors: { _: ['Event not found.'] } };
  }

  const raw = {
    title: formData.get('title') as string,
    description: (formData.get('description') as string) || '',
    startsAt: formData.get('startsAt') as string,
    endsAt: (formData.get('endsAt') as string) || '',
    venueName: (formData.get('venueName') as string) || '',
    venueAddress: (formData.get('venueAddress') as string) || '',
    isOnline: formData.get('isOnline') === 'true',
    onlineLink: (formData.get('onlineLink') as string) || '',
    imageUrl: (formData.get('imageUrl') as string) || '',
    registrationUrl: (formData.get('registrationUrl') as string) || '',
    cost: (formData.get('cost') as string) || 'free',
  };

  const parsed = editEventSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const data = parsed.data;
  if (new Date(data.endsAt) <= new Date(data.startsAt)) {
    return {
      success: false,
      errors: { endsAt: ['End time must be after start time'] },
    };
  }

  return withAction(
    async () => {
      await db.event.update({
        where: { id: existing.id },
        data: {
          title: data.title,
          description: data.description || null,
          startsAt: new Date(data.startsAt),
          endsAt: new Date(data.endsAt),
          venueName: data.venueName || null,
          venueAddress: data.venueAddress || null,
          isOnline: data.isOnline,
          onlineLink: data.onlineLink || null,
          imageUrl: data.imageUrl || null,
          registrationUrl: data.registrationUrl || null,
          cost: data.cost,
          moderationState: 'PUBLISHED',
        },
      });

      revalidateTag('city-feed', 'max');
      redirect('/organizer/events');
      return { success: true } as EditEventResult;
    },
    () => ({ success: false, errors: { _: ['Something went wrong. Please try again.'] } }),
  );
}
