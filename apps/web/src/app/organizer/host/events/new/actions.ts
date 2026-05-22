'use server';

import { redirect } from 'next/navigation';
import { revalidateTag } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/session';
import { withAction } from '@/lib/api/handlers';
import slugify from 'slugify';

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
    .optional()
    .or(z.literal(''))
    .refine((v) => !v || !isNaN(Date.parse(v)), { message: 'Invalid end date' }),
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
        metadata: { path: ['hostUserId'], equals: user.id },
        startsAt: { gte: new Date() },
        status: 'UPCOMING',
        trustSignals: { none: {} },
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

  return withAction(
    async () => {
      // Generate a unique slug
      const baseSlug = slugify(data.title, { lower: true, strict: true });
      const year = new Date(data.startsAt).getFullYear();
      let slug = `${baseSlug}-${year}`;
      const existing = await db.event.findUnique({ where: { slug }, select: { id: true } });
      if (existing) {
        const suffix = Math.random().toString(36).slice(2, 6);
        slug = `${baseSlug}-${year}-${suffix}`;
      }

      const event = await db.event.create({
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
          source: 'COMMUNITY_SUBMITTED',
          metadata: { hostUserId: user.id },
        },
      });

      revalidateTag(`city-events-${data.cityId}`, 'max');

      redirect(`/organizer/host/events`);
      return { success: true, eventSlug: event.slug } as AddHostEventResult;
    },
    () =>
      ({
        success: false,
        errors: { _: ['Something went wrong. Please try again.'] },
      }) as AddHostEventResult,
  );
}
