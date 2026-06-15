'use server';

import { revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/session';
import { withAction } from '@/lib/api/handlers';
import {
  parseDateTimeLocalInTimeZone,
  DEFAULT_EVENT_TIMEZONE,
} from '@/lib/datetime/event-timezone';
import {
  DEFAULT_RECURRENCE_PRESET,
  recurrencePresetSchema,
  recurrencePresetToRule,
} from '@/lib/events/recurrence';

const editHostEventSchema = z.object({
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
  registrationUrl: z.string().url().optional().or(z.literal('')),
  cost: z.enum(['free', 'paid', 'unclear']).default('free'),
  accessType: z
    .enum([
      'OPEN_ENTRY',
      'REGISTRATION_REQUIRED',
      'APPROVAL_REQUIRED',
      'INVITE_ONLY',
      'MEMBERS_ONLY',
      'UNCLEAR',
    ])
    .default('UNCLEAR'),
  recurrencePreset: recurrencePresetSchema.default(DEFAULT_RECURRENCE_PRESET),
});

export type EditHostEventResult =
  | { success: true }
  | { success: false; errors: Record<string, string[]> }
  | null;

export async function editHostEvent(
  eventSlug: string,
  _prev: EditHostEventResult,
  formData: FormData,
): Promise<EditHostEventResult> {
  const user = await getSessionUser();
  if (!user || (user.role !== 'EVENT_HOST' && user.role !== 'PLATFORM_ADMIN')) {
    return { success: false, errors: { _: ['Not authenticated as event host'] } };
  }

  const event = await db.event.findFirst({
    where: { slug: eventSlug, createdByUserId: user.id },
    select: { id: true, cityId: true, city: { select: { timezone: true } }, recurrenceRule: true },
  });

  if (!event) {
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
    registrationUrl: (formData.get('registrationUrl') as string) || '',
    cost: (formData.get('cost') as string) || 'free',
    accessType: (formData.get('accessType') as string) || 'UNCLEAR',
    recurrencePreset: String(formData.get('recurrencePreset') ?? DEFAULT_RECURRENCE_PRESET),
  };

  const parsed = editHostEventSchema.safeParse(raw);
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

  const timeZone = event.city.timezone || DEFAULT_EVENT_TIMEZONE;
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
      ? event.recurrenceRule
      : recurrencePresetToRule(data.recurrencePreset);

  return withAction(
    async () => {
      await db.event.update({
        where: { id: event.id },
        data: {
          title: data.title,
          description: data.description || null,
          startsAt,
          endsAt,
          venueName: data.venueName || null,
          venueAddress: data.venueAddress || null,
          isOnline: data.isOnline,
          onlineLink: data.onlineLink || null,
          registrationUrl: data.registrationUrl || null,
          cost: data.cost,
          costType: data.cost === 'free' ? 'FREE' : data.cost === 'paid' ? 'PAID' : 'UNCLEAR',
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
          moderationState: 'PENDING_REVIEW',
          reviewedById: null,
          reviewedAt: null,
          reviewReason: null,
        },
      });

      // City is immutable on edit — events stay bound to their original
      // discovery partition. Revalidate using the persisted city, not input.
      revalidateTag(`city-events-${event.cityId}`, 'max');
      revalidateTag('city-feed', 'max');

      redirect('/organizer/host/events');
      return { success: true } as EditHostEventResult;
    },
    () => ({ success: false, errors: { _: ['Something went wrong. Please try again.'] } }),
  );
}
