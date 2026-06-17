'use server';

import { revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getCurrentCommunityId, getSessionUser } from '@/lib/session';
import { withAction } from '@/lib/api/handlers';
import { canEditCommunity } from '@/lib/auth/community-permissions';
import {
  parseDateTimeLocalInTimeZone,
  DEFAULT_EVENT_TIMEZONE,
} from '@/lib/datetime/event-timezone';
import {
  DEFAULT_RECURRENCE_PRESET,
  recurrencePresetSchema,
  recurrencePresetToRule,
} from '@/lib/events/recurrence';
import {
  baseEventFormSchema,
  hasValidTimeRange,
  normalizeCategorySlugs,
  readBaseEventFormData,
  toStructuredCostType,
  validateOnlineOfflineRequirements,
} from '@/lib/events/form-input';
import {
  resolveActiveOrganizerCommunity,
  type OrganizerSessionCommunity,
} from '@/lib/organizer/workspace';

const editEventSchema = baseEventFormSchema.extend({
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

  const raw = readBaseEventFormData(formData);

  const parsed = editEventSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const data = parsed.data;
  const locationErrors = validateOnlineOfflineRequirements(data);
  if (locationErrors) return { success: false, errors: locationErrors };

  const timeZone = existing.city.timezone || DEFAULT_EVENT_TIMEZONE;
  const startsAt = parseDateTimeLocalInTimeZone(data.startsAt, timeZone);
  const endsAt = parseDateTimeLocalInTimeZone(data.endsAt, timeZone);
  if (!startsAt) {
    return { success: false, errors: { startsAt: ['Invalid start date'] } };
  }
  if (!endsAt) {
    return { success: false, errors: { endsAt: ['Invalid end date'] } };
  }
  if (!hasValidTimeRange(startsAt, endsAt)) {
    return {
      success: false,
      errors: { endsAt: ['End time must be after start time'] },
    };
  }

  const categorySlugs = normalizeCategorySlugs(data.categorySlugs);
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
          costType: toStructuredCostType(data.cost),
          accessType: data.accessType,
          requiresRegistration:
            data.accessType === 'REGISTRATION_REQUIRED' || data.accessType === 'APPROVAL_REQUIRED',
          requiresApproval: data.accessType === 'APPROVAL_REQUIRED',
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
