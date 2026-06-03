'use server';

import { revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getCurrentCommunityId, getSessionUser } from '@/lib/session';
import { withAction } from '@/lib/api/handlers';
import { canEditCommunity } from '@/lib/auth/community-permissions';
import { parseDateTimeLocalInTimeZone } from '@/lib/datetime/event-timezone';
import {
  DEFAULT_RECURRENCE_PRESET,
  recurrencePresetSchema,
  recurrencePresetToRule,
} from '@/lib/events/recurrence';
import {
  resolveActiveOrganizerCommunity,
  type OrganizerSessionCommunity,
} from '@/lib/organizer/workspace';

const editEventSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(5000).optional().or(z.literal('')),
  categorySlugs: z.array(z.string().min(1)).min(1, 'Select at least one category.'),
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
  recurrencePreset: recurrencePresetSchema.default(DEFAULT_RECURRENCE_PRESET),
});

export type EditEventResult =
  | { success: true }
  | { success: false; errors: Record<string, string[]> }
  | null;

export async function editEvent(
  eventSlug: string,
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

  const existing = await db.event.findFirst({
    where: { slug: eventSlug, communityId: community.id },
    select: { id: true, recurrenceRule: true, city: { select: { timezone: true } } },
  });

  if (!existing) {
    return { success: false, errors: { _: ['Event not found.'] } };
  }

  const raw = {
    title: formData.get('title') as string,
    description: (formData.get('description') as string) || '',
    categorySlugs: formData.getAll('categorySlugs').map((value) => String(value)),
    startsAt: formData.get('startsAt') as string,
    endsAt: (formData.get('endsAt') as string) || '',
    venueName: (formData.get('venueName') as string) || '',
    venueAddress: (formData.get('venueAddress') as string) || '',
    isOnline: formData.get('isOnline') === 'true',
    onlineLink: (formData.get('onlineLink') as string) || '',
    imageUrl: (formData.get('imageUrl') as string) || '',
    registrationUrl: (formData.get('registrationUrl') as string) || '',
    cost: (formData.get('cost') as string) || 'free',
    recurrencePreset: String(formData.get('recurrencePreset') ?? DEFAULT_RECURRENCE_PRESET),
  };

  const parsed = editEventSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const data = parsed.data;
  if (data.isOnline && !data.onlineLink) {
    return {
      success: false,
      errors: { onlineLink: ['Online events require an online link.'] },
    };
  }

  if (!data.isOnline && (!data.venueName || !data.venueAddress)) {
    return {
      success: false,
      errors: {
        ...(data.venueName ? {} : { venueName: ['Venue name is required for offline events.'] }),
        ...(data.venueAddress
          ? {}
          : { venueAddress: ['Venue address is required for offline events.'] }),
      },
    };
  }

  const timeZone = existing.city.timezone || 'Europe/Berlin';
  const startsAt = parseDateTimeLocalInTimeZone(data.startsAt, timeZone);
  const endsAt = parseDateTimeLocalInTimeZone(data.endsAt, timeZone);
  if (!startsAt) {
    return { success: false, errors: { startsAt: ['Invalid start date'] } };
  }
  if (!endsAt) {
    return { success: false, errors: { endsAt: ['Invalid end date'] } };
  }
  if (endsAt <= startsAt) {
    return {
      success: false,
      errors: { endsAt: ['End time must be after start time'] },
    };
  }

  const categorySlugs = Array.from(new Set(data.categorySlugs.map((slug) => slug.trim()))).filter(
    Boolean,
  );
  const categories = await db.category.findMany({
    where: { type: 'CATEGORY', slug: { in: categorySlugs } },
    select: { slug: true },
  });
  if (categories.length !== categorySlugs.length) {
    return {
      success: false,
      errors: { categorySlugs: ['Please select valid categories.'] },
    };
  }

  const recurrenceRule =
    data.recurrencePreset === 'custom'
      ? existing.recurrenceRule
      : recurrencePresetToRule(data.recurrencePreset);

  return withAction(
    async () => {
      await db.event.update({
        where: { id: existing.id },
        data: {
          title: data.title,
          description: data.description || null,
          startsAt,
          endsAt,
          venueName: data.venueName || null,
          venueAddress: data.venueAddress || null,
          isOnline: data.isOnline,
          onlineLink: data.onlineLink || null,
          imageUrl: data.imageUrl || null,
          registrationUrl: data.registrationUrl || null,
          cost: data.cost,
          isRecurring: recurrenceRule !== null,
          recurrenceRule,
          categories: {
            deleteMany: {},
            create: categories.map((category) => ({
              category: { connect: { slug: category.slug } },
            })),
          },
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
