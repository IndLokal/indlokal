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
  parseDateTimeLocalInTimeZone,
  DEFAULT_EVENT_TIMEZONE,
} from '@/lib/datetime/event-timezone';
import {
  createRecurrencePresetSchema,
  DEFAULT_RECURRENCE_PRESET,
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

const addEventSchema = baseEventFormSchema.extend({
  recurrencePreset: createRecurrencePresetSchema.default(DEFAULT_RECURRENCE_PRESET),
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

  const raw = readBaseEventFormData(formData);

  const parsed = addEventSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const data = parsed.data;
  const locationErrors = validateOnlineOfflineRequirements(data);
  if (locationErrors) return { success: false, errors: locationErrors };

  const timezoneRow = await db.community.findUnique({
    where: { id: community.id },
    select: { city: { select: { timezone: true } } },
  });
  const timeZone = timezoneRow?.city.timezone || DEFAULT_EVENT_TIMEZONE;

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

  const recurrenceRule = recurrencePresetToRule(data.recurrencePreset);

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
          startsAt,
          endsAt,
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
            create: categories.map((category) => ({
              category: { connect: { slug: category.slug } },
            })),
          },
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

      // Write lastActivityAt so DB-level freshness queries are current (TDD-0045)
      await db.community.update({
        where: { id: community.id },
        data: { lastActivityAt: new Date() },
      });

      // Refresh scores so new events immediately affect rankings
      await refreshCommunityScore(community.id);

      revalidateTag('city-feed', 'max');
      redirect('/organizer/events');
    },
    () => ({ success: false, errors: { _: ['Something went wrong. Please try again.'] } }),
  );
}
