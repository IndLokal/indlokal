'use server';

import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/session';
import { db } from '@/lib/db';

export type PreferencesResult = { success: true } | { success: false; error: string } | null;

export async function updatePreferences(
  _prev: PreferencesResult,
  formData: FormData,
): Promise<PreferencesResult> {
  const user = await getSessionUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const cityId = (formData.get('cityId') as string) || null;
  const personaSegments = formData.getAll('personaSegments') as string[];
  const preferredLanguages = formData.getAll('preferredLanguages') as string[];

  // Validate cityId belongs to an active city if provided
  if (cityId) {
    const city = await db.city.findFirst({
      where: { id: cityId, isActive: true },
      select: { id: true },
    });
    if (!city) return { success: false, error: 'Invalid city selection' };
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      cityId: cityId ?? null,
      personaSegments,
      preferredLanguages,
    },
  });

  revalidatePath('/me');
  return { success: true };
}
