'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/session';
import { ActivitySignalType } from '@prisma/client';

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

  const community = user.claimedCommunities[0];

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

  await db.community.update({
    where: { id: community.id },
    data: {
      name: data.name,
      description: data.description,
      descriptionLong: data.descriptionLong || null,
      languages: data.languages,
      foundedYear: data.foundedYear && !isNaN(data.foundedYear) ? data.foundedYear : null,
      memberCountApprox:
        data.memberCountApprox && !isNaN(data.memberCountApprox) ? data.memberCountApprox : null,
    },
  });

  await db.activitySignal.create({
    data: {
      communityId: community.id,
      signalType: ActivitySignalType.PROFILE_UPDATED,
    },
  });

  revalidatePath(`/${community.city.slug}/communities/${community.slug}`);
  revalidatePath('/organizer');

  return { success: true };
}
