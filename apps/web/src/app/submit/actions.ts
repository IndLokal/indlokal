'use server';

import { db } from '@/lib/db';
import type { ChannelType } from '@prisma/client';
import { submitCommunitySchema } from '@/lib/validation';
import slugify from 'slugify';
import { sendSubmissionReceivedEmail } from '@/lib/email';
import { captureServerEvent } from '@/lib/analytics/server';
import { Events } from '@/lib/analytics/events';
import { headers } from 'next/headers';
import { checkRateLimit, submitLimiter } from '@/lib/rate-limit';
import { computeSimilarity } from '@/modules/pipeline';

export type SubmitResult =
  | { success: true; communityName: string }
  | { success: false; errors: Record<string, string[]> }
  | null;

export async function submitCommunity(
  _prev: SubmitResult,
  formData: FormData,
): Promise<SubmitResult> {
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!checkRateLimit(submitLimiter, ip).allowed) {
    return { success: false, errors: { name: ['Too many submissions. Please try again later.'] } };
  }

  const raw = {
    name: formData.get('name') as string,
    description: formData.get('description') as string,
    citySlug: formData.get('citySlug') as string,
    categories: formData.getAll('categories') as string[],
    languages: formData.getAll('languages') as string[],
    primaryChannelType: formData.get('primaryChannelType') as string,
    primaryChannelUrl: formData.get('primaryChannelUrl') as string,
    secondaryChannelType: (formData.get('secondaryChannelType') as string) || undefined,
    secondaryChannelUrl: (formData.get('secondaryChannelUrl') as string) || undefined,
    contactEmail: formData.get('contactEmail') as string,
    contactName: formData.get('contactName') as string,
  };

  const parsed = submitCommunitySchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const data = parsed.data;

  // Secondary channel type requires a URL
  if (data.secondaryChannelType && !data.secondaryChannelUrl) {
    return {
      success: false,
      errors: {
        secondaryChannelUrl: ['A URL is required when a secondary channel type is selected'],
      },
    };
  }

  // Resolve city
  const city = await db.city.findFirst({
    where: { slug: data.citySlug, isActive: true },
    select: { id: true },
  });
  if (!city) {
    return { success: false, errors: { citySlug: ['City not found or not active'] } };
  }

  // Dedup check — prevent duplicate submissions
  const existingCommunities = await db.community.findMany({
    where: { cityId: city.id, status: { not: 'INACTIVE' } },
    select: { name: true },
  });
  for (const c of existingCommunities) {
    if (computeSimilarity(data.name.toLowerCase(), c.name.toLowerCase()) > 0.7) {
      return {
        success: false,
        errors: { name: [`A similar community "${c.name}" already exists.`] },
      };
    }
  }

  // Generate unique slug
  let slug = slugify(data.name, { lower: true, strict: true });
  const existing = await db.community.findUnique({ where: { slug } });
  if (existing) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  // Resolve category IDs
  const categoryRows = await db.category.findMany({
    where: { slug: { in: data.categories }, type: 'CATEGORY' },
    select: { id: true },
  });

  if (categoryRows.length !== data.categories.length) {
    return {
      success: false,
      errors: { categories: ['One or more selected categories are invalid'] },
    };
  }

  // Build access channels
  const channels: { channelType: ChannelType; url: string; label: string; isPrimary: boolean }[] = [
    {
      channelType: data.primaryChannelType,
      url: data.primaryChannelUrl,
      label: data.primaryChannelType,
      isPrimary: true,
    },
  ];
  if (data.secondaryChannelType && data.secondaryChannelUrl) {
    channels.push({
      channelType: data.secondaryChannelType,
      url: data.secondaryChannelUrl,
      label: data.secondaryChannelType,
      isPrimary: false,
    });
  }

  // Create community as UNVERIFIED
  try {
    await db.community.create({
      data: {
        name: data.name,
        slug,
        description: data.description,
        cityId: city.id,
        languages: data.languages,
        status: 'UNVERIFIED',
        claimState: 'UNCLAIMED',
        source: 'COMMUNITY_SUBMITTED',
        metadata: {
          submitter: {
            name: data.contactName,
            email: data.contactEmail,
            submittedAt: new Date().toISOString(),
          },
        },
        categories: {
          create: categoryRows.map((c) => ({ categoryId: c.id })),
        },
        accessChannels: { create: channels },
      },
    });
  } catch {
    return { success: false, errors: { name: ['Failed to create community. Please try again.'] } };
  }

  // Email is best-effort — don't fail the submission if it doesn't send
  try {
    await sendSubmissionReceivedEmail(data.contactEmail, data.contactName, data.name);
  } catch {
    // silently ignore email failure
  }

  // Analytics — fire-and-forget, non-critical
  // Use 'anonymous' as distinctId for unauthenticated submissions to avoid PII in PostHog
  await captureServerEvent('anonymous-submitter', Events.COMMUNITY_SUBMITTED, {
    city: data.citySlug,
    channel_types: channels.map((c) => c.channelType.toLowerCase()),
  });

  return { success: true, communityName: data.name };
}
