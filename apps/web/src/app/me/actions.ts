'use server';

import { revalidatePath } from 'next/cache';
import { communityOptions } from '@indlokal/shared';
import { getSessionUser } from '@/lib/session';
import { db } from '@/lib/db';
import { withAction } from '@/lib/api/handlers';

export type PreferencesResult = { success: true } | { success: false; error: string } | null;

const VALID_PERSONAS = new Set(communityOptions.PERSONA_SEGMENT_VALUES);
const VALID_LANGUAGES = new Set(communityOptions.COMMUNITY_LANGUAGE_VALUES);

export async function updatePreferences(
  _prev: PreferencesResult,
  formData: FormData,
): Promise<PreferencesResult> {
  const user = await getSessionUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const cityId = (formData.get('cityId') as string) || null;
  const personaSegments = (formData.getAll('personaSegments') as string[]).filter((p) =>
    VALID_PERSONAS.has(p as (typeof communityOptions.PERSONA_SEGMENT_VALUES)[number]),
  );
  const preferredLanguages = (formData.getAll('preferredLanguages') as string[]).filter((l) =>
    VALID_LANGUAGES.has(l as (typeof communityOptions.COMMUNITY_LANGUAGE_VALUES)[number]),
  );

  return withAction(
    async () => {
      // Validate cityId belongs to an active city if provided
      if (cityId) {
        const city = await db.city.findFirst({
          where: { id: cityId, isActive: true },
          select: { id: true },
        });
        if (!city) return { success: false, error: 'Invalid city selection' } as PreferencesResult;
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
      return { success: true } as PreferencesResult;
    },
    () => ({ success: false, error: 'Something went wrong. Please try again.' }),
  );
}
