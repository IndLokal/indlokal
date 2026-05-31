'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getSessionUser, getCurrentCommunityId } from '@/lib/session';
import { withAction } from '@/lib/api/handlers';
import { refreshCommunityScore } from '@/modules/scoring';
import { canEditCommunity } from '@/lib/auth/community-permissions';
import {
  resolveActiveOrganizerCommunity,
  type OrganizerSessionCommunity,
} from '@/lib/organizer/workspace';

const editProfileSchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().min(10).max(2000),
  descriptionLong: z.string().max(10000).optional().or(z.literal('')),
  languages: z.array(z.string()).default([]),
  foundedYear: z.coerce
    .number()
    .int()
    .min(1900)
    .max(new Date().getFullYear())
    .optional()
    .or(z.nan()),
  memberCountApprox: z.coerce.number().int().min(0).optional().or(z.nan()),
});

export type EditProfileResult =
  | { success: true }
  | { success: false; errors: Record<string, string[]> }
  | null;

export async function editCommunityProfile(
  _prev: EditProfileResult,
  formData: FormData,
): Promise<EditProfileResult> {
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
      errors: { _: ['You do not have permission to edit this community.'] },
    };
  }

  const languagesRaw = formData.getAll('languages') as string[];

  const raw = {
    name: formData.get('name') as string,
    description: formData.get('description') as string,
    descriptionLong: (formData.get('descriptionLong') as string) || undefined,
    languages: languagesRaw,
    foundedYear: formData.get('foundedYear') ? Number(formData.get('foundedYear')) : undefined,
    memberCountApprox: formData.get('memberCountApprox')
      ? Number(formData.get('memberCountApprox'))
      : undefined,
  };

  const parsed = editProfileSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const data = parsed.data;

  return withAction(
    async () => {
      await db.community.update({
        where: { id: community.id },
        data: {
          name: data.name,
          description: data.description,
          descriptionLong: data.descriptionLong || null,
          languages: data.languages,
          foundedYear: data.foundedYear && !isNaN(data.foundedYear) ? data.foundedYear : null,
          memberCountApprox:
            data.memberCountApprox && !isNaN(data.memberCountApprox)
              ? data.memberCountApprox
              : null,
        },
      });

      await db.activitySignal.create({
        data: {
          communityId: community.id,
          signalType: 'PROFILE_UPDATED',
        },
      });

      // Refresh completeness score after profile edit
      await refreshCommunityScore(community.id);

      revalidatePath(`/${community.city.slug}/communities/${community.slug}`);
      revalidatePath('/organizer');
      revalidatePath('/organizer/profile');
      revalidateTag('city-feed', 'max');

      return { success: true } as EditProfileResult;
    },
    () => ({ success: false, errors: { _: ['Something went wrong. Please try again.'] } }),
  );
}
