'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { assertCan } from '@/lib/auth/permissions';

function getAuthorizedCityId(
  user: Awaited<ReturnType<typeof assertCan>>,
  cityId: string | null,
): string | null {
  const allowedCityIds = user.roleAssignments
    .filter(
      (assignment) =>
        assignment.role === 'CITY_AMBASSADOR' && assignment.cityId && !assignment.revokedAt,
    )
    .map((assignment) => assignment.cityId as string);

  if (allowedCityIds.length === 0) return null;
  if (cityId) return allowedCityIds.includes(cityId) ? cityId : null;
  return allowedCityIds.length === 1 ? allowedCityIds[0] : null;
}

// ─────────────────────────────────────────────────
// Submit community (fast-track to pipeline)
// Creates a PipelineItem with submittedByRole=CITY_AMBASSADOR
// so it surfaces at the top of the admin pipeline queue.
// ─────────────────────────────────────────────────

export type SubmitResult = { success: true; message: string } | { success: false; error: string };

export async function submitAmbassadorCommunity(
  _prev: SubmitResult | null,
  formData: FormData,
): Promise<SubmitResult> {
  const user = await assertCan('ambassador.submit');

  const name = (formData.get('name') as string | null)?.trim();
  const description = (formData.get('description') as string | null)?.trim();
  const cityId = (formData.get('cityId') as string | null)?.trim();
  const channelUrl = (formData.get('channelUrl') as string | null)?.trim();
  const channelType = (formData.get('channelType') as string | null)?.trim() || 'WHATSAPP';
  const notes = (formData.get('notes') as string | null)?.trim();

  const authorizedCityId = getAuthorizedCityId(user, cityId || null);
  if (!authorizedCityId) {
    return { success: false, error: 'Please select one of your assigned cities.' };
  }

  if (!name || !authorizedCityId) {
    return { success: false, error: 'Name and city are required.' };
  }

  // Resolve city
  const city = await db.city.findUnique({ where: { id: authorizedCityId }, select: { id: true } });
  if (!city) return { success: false, error: 'Invalid city.' };

  await db.pipelineItem.create({
    data: {
      entityType: 'COMMUNITY',
      sourceType: 'USER_SUBMITTED',
      cityId: city.id,
      confidence: 0.75, // ambassador submissions start with higher confidence
      submittedBy: user.id,
      extractedData: {
        name,
        description: description ?? '',
        channelType,
        channelUrl: channelUrl ?? '',
        notes: notes ?? '',
      },
      metadata: {
        submittedByRole: 'CITY_AMBASSADOR',
        submittedByUserId: user.id,
      },
    },
  });

  revalidatePath('/ambassador');
  revalidatePath('/admin/pipeline');
  return { success: true, message: `"${name}" submitted to the fast-track queue.` };
}

// ─────────────────────────────────────────────────
// Submit event (fast-track to pipeline)
// ─────────────────────────────────────────────────

export async function submitAmbassadorEvent(
  _prev: SubmitResult | null,
  formData: FormData,
): Promise<SubmitResult> {
  const user = await assertCan('ambassador.submit');

  const title = (formData.get('title') as string | null)?.trim();
  const description = (formData.get('description') as string | null)?.trim();
  const cityId = (formData.get('cityId') as string | null)?.trim();
  const startDate = (formData.get('startDate') as string | null)?.trim();
  const location = (formData.get('location') as string | null)?.trim();
  const communityName = (formData.get('communityName') as string | null)?.trim();
  const sourceUrl = (formData.get('sourceUrl') as string | null)?.trim();
  const notes = (formData.get('notes') as string | null)?.trim();

  const authorizedCityId = getAuthorizedCityId(user, cityId || null);
  if (!authorizedCityId) {
    return { success: false, error: 'Please select one of your assigned cities.' };
  }

  if (!title || !authorizedCityId) {
    return { success: false, error: 'Title and city are required.' };
  }

  const city = await db.city.findUnique({ where: { id: authorizedCityId }, select: { id: true } });
  if (!city) return { success: false, error: 'Invalid city.' };

  await db.pipelineItem.create({
    data: {
      entityType: 'EVENT',
      sourceType: 'USER_SUBMITTED',
      sourceUrl: sourceUrl ?? null,
      cityId: city.id,
      confidence: 0.75,
      submittedBy: user.id,
      extractedData: {
        title,
        description: description ?? '',
        startDate: startDate ?? '',
        location: location ?? '',
        communityName: communityName ?? '',
        notes: notes ?? '',
      },
      metadata: {
        submittedByRole: 'CITY_AMBASSADOR',
        submittedByUserId: user.id,
      },
    },
  });

  revalidatePath('/ambassador');
  revalidatePath('/admin/pipeline');
  return { success: true, message: `"${title}" submitted to the fast-track queue.` };
}
