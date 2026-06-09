'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { assertCan } from '@/lib/auth/permissions';
import { getAuthorizedCityId } from '@/lib/auth/ambassador';
import type { SubmitResult } from '../lib/form-state';
import {
  buildAmbassadorCommunityExtractedData,
  buildAmbassadorEventExtractedData,
  normalizeCommunityChannelType,
  sanitizeLanguages,
} from '../lib/submission-mapping';

// ─────────────────────────────────────────────────
// Submit community (fast-track to pipeline)
// Creates a PipelineItem with submittedByRole=CITY_AMBASSADOR
// so it surfaces at the top of the admin pipeline queue.
// ─────────────────────────────────────────────────

function getStringValues(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean);
}

export async function submitAmbassadorCommunity(
  _prev: SubmitResult | null,
  formData: FormData,
): Promise<SubmitResult> {
  const user = await assertCan('ambassador.submit');

  const name = (formData.get('name') as string | null)?.trim();
  const description = (formData.get('description') as string | null)?.trim();
  const cityId = (formData.get('cityId') as string | null)?.trim();
  const channelValue = (formData.get('channelValue') as string | null)?.trim();
  const channelTypeRaw = (formData.get('channelType') as string | null)?.trim();
  const contactEmail = (formData.get('contactEmail') as string | null)?.trim();
  const categories = getStringValues(formData, 'categories');
  const languages = sanitizeLanguages(getStringValues(formData, 'languages'));
  const notes = (formData.get('notes') as string | null)?.trim();
  const channelType = normalizeCommunityChannelType(channelTypeRaw);

  const authorizedCityId = getAuthorizedCityId(user, cityId || null);
  if (!authorizedCityId) {
    return { success: false, error: 'Please select one of your assigned cities.' };
  }

  if (!name || !authorizedCityId) {
    return { success: false, error: 'Name and city are required.' };
  }

  // Resolve city
  const city = await db.city.findUnique({
    where: { id: authorizedCityId },
    select: { id: true, name: true },
  });
  if (!city) return { success: false, error: 'Invalid city.' };

  const { extracted, supplementalChannels } = buildAmbassadorCommunityExtractedData({
    name,
    description,
    cityName: city.name,
    categories,
    languages,
    channelType,
    channelValue,
    contactEmail,
  });

  await db.pipelineItem.create({
    data: {
      entityType: 'COMMUNITY',
      sourceType: 'USER_SUBMITTED',
      cityId: city.id,
      confidence: 0.75, // ambassador submissions start with higher confidence
      submittedBy: user.id,
      extractedData: extracted,
      metadata: {
        submittedByRole: 'CITY_AMBASSADOR',
        submittedByUserId: user.id,
        ambassadorSubmission: {
          notes: notes ?? null,
          channelType,
          channelValue: channelValue ?? null,
          supplementalChannels,
        },
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
  const startTime = (formData.get('startTime') as string | null)?.trim();
  const endDate = (formData.get('endDate') as string | null)?.trim();
  const endTime = (formData.get('endTime') as string | null)?.trim();
  const venueName = (formData.get('venueName') as string | null)?.trim();
  const venueAddress = (formData.get('venueAddress') as string | null)?.trim();
  const registrationUrl = (formData.get('registrationUrl') as string | null)?.trim();
  const priceType = (formData.get('priceType') as string | null)?.trim();
  const cost = (formData.get('cost') as string | null)?.trim();
  const isOnline = formData.get('isOnline') === 'on';
  const communityName = (formData.get('communityName') as string | null)?.trim();
  const sourceUrl = (formData.get('sourceUrl') as string | null)?.trim();
  const categories = getStringValues(formData, 'categories');
  const languages = sanitizeLanguages(getStringValues(formData, 'languages'));
  const notes = (formData.get('notes') as string | null)?.trim();

  const authorizedCityId = getAuthorizedCityId(user, cityId || null);
  if (!authorizedCityId) {
    return { success: false, error: 'Please select one of your assigned cities.' };
  }

  if (!title || !authorizedCityId) {
    return { success: false, error: 'Title and city are required.' };
  }

  const city = await db.city.findUnique({
    where: { id: authorizedCityId },
    select: { id: true, name: true },
  });
  if (!city) return { success: false, error: 'Invalid city.' };

  const isFree = priceType === 'free' ? true : priceType === 'paid' ? false : null;
  const extractedData = buildAmbassadorEventExtractedData({
    title,
    description,
    date: startDate,
    time: startTime,
    endDate,
    endTime,
    venueName,
    venueAddress,
    cityName: city.name,
    isOnline,
    isFree,
    cost,
    registrationUrl,
    hostCommunity: communityName,
    categories,
    languages,
  });

  await db.pipelineItem.create({
    data: {
      entityType: 'EVENT',
      sourceType: 'USER_SUBMITTED',
      sourceUrl: sourceUrl ?? null,
      cityId: city.id,
      confidence: 0.75,
      submittedBy: user.id,
      extractedData,
      metadata: {
        submittedByRole: 'CITY_AMBASSADOR',
        submittedByUserId: user.id,
        ambassadorSubmission: {
          notes: notes ?? null,
          sourceUrl: sourceUrl ?? null,
        },
      },
    },
  });

  revalidatePath('/ambassador');
  revalidatePath('/admin/pipeline');
  return { success: true, message: `"${title}" submitted to the fast-track queue.` };
}
