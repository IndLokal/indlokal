'use server';

import { revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/session';
import { withAction } from '@/lib/api/handlers';

const editHostEventSchema = z.object({
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

export type EditHostEventResult =
  | { success: true }
  | { success: false; errors: Record<string, string[]> }
  | null;

export async function editHostEvent(
  _prev: EditHostEventResult,
  formData: FormData,
): Promise<EditHostEventResult> {
  const user = await getSessionUser();
  if (!user || user.role !== 'EVENT_HOST') {
    return { success: false, errors: { _: ['Not authenticated as event host'] } };
  }

  const slug = formData.get('slug') as string;
  const event = await db.event.findFirst({
    where: { slug, createdByUserId: user.id },
    select: { id: true, cityId: true },
  });

  if (!event) {
    return { success: false, errors: { _: ['Event not found.'] } };
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

  const parsed = editHostEventSchema.safeParse(raw);
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
        where: { slug },
        data: {
          title: data.title,
          description: data.description || null,
          startsAt: new Date(data.startsAt),
          endsAt: new Date(data.endsAt),
          venueName: data.venueName || null,
          venueAddress: data.venueAddress || null,
          isOnline: data.isOnline,
          onlineLink: data.onlineLink || null,
          registrationUrl: data.registrationUrl || null,
          cost: data.cost,
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
