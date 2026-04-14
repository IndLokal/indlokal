'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/session';
import { ActivitySignalType } from '@prisma/client';
import slugify from 'slugify';

const addEventSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(5000).optional().or(z.literal('')),
  startsAt: z.string().datetime({ offset: true }).or(z.string().min(1)),
  endsAt: z.string().optional().or(z.literal('')),
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
  const community = user.claimedCommunities[0];

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

  // Generate slug
  const baseSlug = slugify(data.title, { lower: true, strict: true });
  const dateStr = new Date(data.startsAt).toISOString().slice(0, 10).replace(/-/g, '');
  let slug = `${baseSlug}-${dateStr}`;

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
    },
  });

  await db.activitySignal.create({
    data: {
      communityId: community.id,
      signalType: ActivitySignalType.EVENT_CREATED,
    },
  });

  redirect(`/${community.city.slug}/events/${event.slug}`);
}
