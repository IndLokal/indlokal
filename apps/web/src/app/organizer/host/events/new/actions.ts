'use server';

import { redirect } from 'next/navigation';
import { revalidateTag } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/session';
import { withAction } from '@/lib/api/handlers';
import { captureServerEvent } from '@/lib/analytics/server';
import { Events } from '@/lib/analytics/events';
import slugify from 'slugify';
import { Prisma } from '@prisma/client';

const addHostEventSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(5000).optional().or(z.literal('')),
  cityId: z.string().min(1),
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
});

export type AddHostEventResult =
  | { success: true; eventSlug: string }
  | { success: false; errors: Record<string, string[]> }
  | null;

const HOST_UNVERIFIED_CAP = 5;

export async function addHostEvent(
  _prev: AddHostEventResult,
  formData: FormData,
): Promise<AddHostEventResult> {
  const user = await getSessionUser();
  if (!user || (user.role !== 'EVENT_HOST' && user.role !== 'PLATFORM_ADMIN')) {
    return { success: false, errors: { _: ['Not authenticated as event host'] } };
  }

  // Enforce unverified event cap
  if (user.role === 'EVENT_HOST') {
    const unverifiedCount = await db.event.count({
      where: {
        createdByUserId: user.id,
        startsAt: { gte: new Date() },
        moderationState: 'PENDING_REVIEW',
      },
    });
    if (unverifiedCount >= HOST_UNVERIFIED_CAP) {
      return {
        success: false,
        errors: {
          _: [
            `You have reached the cap of ${HOST_UNVERIFIED_CAP} unverified upcoming events. Please wait for a team member to review your events before posting more.`,
          ],
        },
      };
    }
  }

  const raw = {
    title: formData.get('title') as string,
    description: (formData.get('description') as string) || '',
    cityId: formData.get('cityId') as string,
    startsAt: formData.get('startsAt') as string,
    endsAt: (formData.get('endsAt') as string) || '',
    venueName: (formData.get('venueName') as string) || '',
    venueAddress: (formData.get('venueAddress') as string) || '',
    isOnline: formData.get('isOnline') === 'true',
    onlineLink: (formData.get('onlineLink') as string) || '',
    registrationUrl: (formData.get('registrationUrl') as string) || '',
    cost: (formData.get('cost') as string) || 'free',
  };

  const parsed = addHostEventSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const data = parsed.data;

  // Validate ordering: endsAt must be after startsAt
  if (new Date(data.endsAt) <= new Date(data.startsAt)) {
    return {
      success: false,
      errors: { endsAt: ['End time must be after start time'] },
    };
  }

  // City is the discovery partition key — never trust a client-supplied id.
  // Verify it resolves to a real, active city before creating the event.
  const city = await db.city.findFirst({
    where: { id: data.cityId, isActive: true },
    select: { id: true },
  });
  if (!city) {
    return { success: false, errors: { cityId: ['Please select a valid city.'] } };
  }

  return withAction(
    async () => {
      // Generate a unique slug with retry on collision (avoids TOCTOU race)
      const baseSlug = slugify(data.title, { lower: true, strict: true });
      const year = new Date(data.startsAt).getFullYear();

      let event: Awaited<ReturnType<typeof db.event.create>> | undefined;
      for (let attempt = 0; attempt < 5; attempt++) {
        const suffix = attempt === 0 ? '' : `-${Math.random().toString(36).slice(2, 6)}`;
        const slug = `${baseSlug}-${year}${suffix}`;
        try {
          event = await db.event.create({
            data: {
              title: data.title,
              slug,
              description: data.description || null,
              communityId: null, // host events have no community
              cityId: data.cityId,
              startsAt: new Date(data.startsAt),
              endsAt: data.endsAt ? new Date(data.endsAt) : null,
              venueName: data.venueName || null,
              venueAddress: data.venueAddress || null,
              isOnline: data.isOnline,
              onlineLink: data.onlineLink || null,
              registrationUrl: data.registrationUrl || null,
              cost: data.cost,
              source: 'USER_SUGGESTED', // unverified host submission
              // ADR-0009: host lane is vetted before public visibility.
              moderationState: 'PENDING_REVIEW',
              createdByUserId: user.id,
              metadata: { hostUserId: user.id },
            },
          });
          break;
        } catch (err) {
          if (
            err instanceof Prisma.PrismaClientKnownRequestError &&
            err.code === 'P2002' &&
            attempt < 4
          ) {
            continue; // slug collision - retry with new random suffix
          }
          throw err;
        }
      }
      if (!event) throw new Error('Could not generate unique slug after 5 attempts');
      const createdEvent = event;

      await captureServerEvent(user.id, Events.HOST_EVENT_SUBMITTED_FOR_REVIEW, {
        event_id: createdEvent.id,
        city_id: data.cityId,
        // Backward-compatible aliases for existing PostHog dashboards.
        eventId: createdEvent.id,
        cityId: data.cityId,
      });

      revalidateTag(`city-events-${data.cityId}`, 'max');

      redirect(`/organizer/host/events`);
      return { success: true, eventSlug: createdEvent.slug } as AddHostEventResult;
    },
    () =>
      ({
        success: false,
        errors: { _: ['Something went wrong. Please try again.'] },
      }) as AddHostEventResult,
  );
}
