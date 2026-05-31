'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/session';
import { captureServerEvent } from '@/lib/analytics/server';
import { Events } from '@/lib/analytics/events';

const updateHostProfileSchema = z.object({
  displayName: z.string().min(2).max(100),
  cityId: z.string().min(1),
  link1: z.string().url().optional().or(z.literal('')),
  link2: z.string().url().optional().or(z.literal('')),
  link3: z.string().url().optional().or(z.literal('')),
});

export type UpdateHostProfileResult = { success: true } | { success: false; error: string } | null;

export async function updateHostProfile(
  _prev: UpdateHostProfileResult,
  formData: FormData,
): Promise<UpdateHostProfileResult> {
  const user = await getSessionUser();
  if (!user || (user.role !== 'EVENT_HOST' && user.role !== 'PLATFORM_ADMIN')) {
    return { success: false, error: 'Not authenticated as event host.' };
  }

  const parsed = updateHostProfileSchema.safeParse({
    displayName: (formData.get('displayName') as string)?.trim(),
    cityId: formData.get('cityId') as string,
    link1: (formData.get('link1') as string) || '',
    link2: (formData.get('link2') as string) || '',
    link3: (formData.get('link3') as string) || '',
  });
  if (!parsed.success) {
    return { success: false, error: 'Please fill in all required fields correctly.' };
  }

  const { displayName, cityId, link1, link2, link3 } = parsed.data;

  // City is the discovery partition key — verify the submitted id resolves to a
  // real, active city before attaching it to the host profile.
  const cityExists = await db.city.findFirst({
    where: { id: cityId, isActive: true },
    select: { id: true },
  });
  if (!cityExists) {
    return { success: false, error: 'Please select a valid city.' };
  }

  const links = [link1, link2, link3].filter(Boolean) as string[];
  const hostProfile = { displayName, cityId, links };

  await db.user.update({
    where: { id: user.id },
    data: {
      displayName,
      cityId,
      metadata: {
        ...(typeof user.metadata === 'object' && user.metadata !== null
          ? (user.metadata as object)
          : {}),
        hostProfile,
      },
    },
  });

  await captureServerEvent(user.id, Events.HOST_PROFILE_UPDATED, {
    linkCount: links.length,
  });

  revalidatePath('/organizer/host');
  revalidatePath('/organizer/host/profile');

  return { success: true };
}
