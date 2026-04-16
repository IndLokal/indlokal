'use server';

import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/session';
import { db } from '@/lib/db';

export type PreferencesResult = { success: true } | { success: false; error: string } | null;

const VALID_PERSONAS = ['STUDENT', 'PROFESSIONAL', 'FAMILY', 'EXPAT', 'VISITOR'];
const VALID_LANGUAGES = ['en', 'de', 'hi', 'ta', 'te', 'ml', 'kn', 'bn', 'mr', 'gu', 'pa'];

export async function updatePreferences(
  _prev: PreferencesResult,
  formData: FormData,
): Promise<PreferencesResult> {
  const user = await getSessionUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const cityId = (formData.get('cityId') as string) || null;
  const personaSegments = (formData.getAll('personaSegments') as string[]).filter((p) =>
    VALID_PERSONAS.includes(p),
  );
  const preferredLanguages = (formData.getAll('preferredLanguages') as string[]).filter((l) =>
    VALID_LANGUAGES.includes(l),
  );

  // Validate cityId belongs to an active city if provided
  if (cityId) {
    const city = await db.city.findFirst({
      where: { id: cityId, isActive: true },
      select: { id: true },
    });
    if (!city) return { success: false, error: 'Invalid city selection' };
  }

  try {
    await db.user.update({
      where: { id: user.id },
      data: {
        cityId: cityId ?? null,
        personaSegments,
        preferredLanguages,
      },
    });
  } catch {
    return { success: false, error: 'Failed to save preferences. Please try again.' };
  }

  revalidatePath('/me');
  return { success: true };
}
