'use server';

import { redirect } from 'next/navigation';
import { revalidateTag } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getSessionUser, getCurrentCommunityId } from '@/lib/session';
import { withAction } from '@/lib/api/handlers';
import { refreshCommunityScore } from '@/modules/scoring';
import { enqueueCommunityUpdateForFollowers } from '@/modules/engagement';
import slugify from 'slugify';
import { canEditCommunity } from '@/lib/auth/community-permissions';
import {
  resolveActiveOrganizerCommunity,
  type OrganizerSessionCommunity,
} from '@/lib/organizer/workspace';

const addEventSchema = z.object({
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

export type AddEventResult =
  | { success: true; eventSlug: string }
  | { success: false; errors: Record<string, string[]> }
  | null;

export async function addEvent(_prev: AddEventResult, formData: FormData): Promise<AddEventResult> {
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
      errors: { _: ['You do not have permission to add events for this community.'] },
    };
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

  const parsed = addEventSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const data = parsed.data;

  // Validate ordering: endsAt must be after startsAt
  if (data.endsAt && data.endsAt !== '' && new Date(data.endsAt) <= new Date(data.startsAt)) {
    return {
      success: false,
      errors: { endsAt: ['End time must be after start time'] },
    };
  }

  // Generate slug
  const baseSlug = slugify(data.title, { lower: true, strict: true });
  const dateStr = new Date(data.startsAt).toISOString().slice(0, 10).replace(/-/g, '');
  let slug = `${baseSlug}-${dateStr}`;

  return withAction(
    async () => {
      const exists = await db.event.findUnique({ where: { slug } });
      if (exists) {
        slug = `${slug}-${Date.now()}`;
      }

      const event = await db.event.create({
        data: {
          title: data.title,
          slug,
          description: data.description || null,
          communityId: community.id,
          cityId: community.city.id,
          venueName: data.venueName || null,
          venueAddress: data.venueAddress || null,
          startsAt: new Date(data.startsAt),
          endsAt: data.endsAt ? new Date(data.endsAt) : null,
          isOnline: data.isOnline,
          onlineLink: data.onlineLink || null,
          imageUrl: data.imageUrl || null,
          registrationUrl: data.registrationUrl || null,
          cost: data.cost,
          status: 'UPCOMING',
          source: 'COMMUNITY_SUBMITTED',
          // ADR-0009: community-trusted lane publishes immediately and records
          // the accountable creator.
          moderationState: 'PUBLISHED',
          createdByUserId: user.id,
        },
      });

      try {
        await enqueueCommunityUpdateForFollowers({
          communityId: community.id,
          eventId: event.id,
          updateId: `event:${event.id}:published`,
        });
      } catch {
        // Notification fan-out is best-effort; the event itself is already published.
      }

      await db.activitySignal.create({
        data: {
          communityId: community.id,
          signalType: 'EVENT_CREATED',
        },
      });

      // Refresh scores so new events immediately affect rankings
      await refreshCommunityScore(community.id);

      revalidateTag('city-feed', 'max');
      redirect('/organizer/events');
    },
    () => ({ success: false, errors: { _: ['Something went wrong. Please try again.'] } }),
  );
}
