'use server';

import { db } from '@/lib/db';
import { communityOptions } from '@indlokal/shared';
import { submitCommunitySchema } from '@/lib/validation';
import slugify from 'slugify';
import { sendSubmissionReceivedEmail } from '@/lib/email';
import { captureServerEvent } from '@/lib/analytics/server';
import { Events } from '@/lib/analytics/events';
import { headers } from 'next/headers';
import { checkRateLimit, submitLimiter } from '@/lib/rate-limit';
import { computeSimilarity } from '@/modules/pipeline';
import { buildStoredEvidence } from '@/lib/community-trust';

export type SubmitResult =
  | { success: true; communityName: string }
  | { success: false; errors: Record<string, string[]> }
  | null;

export async function submitCommunity(
  _prev: SubmitResult,
  formData: FormData,
): Promise<SubmitResult> {
  const noticePolicyVersion = '2026-05-v1';
  const noticeRecordedAt = new Date().toISOString();
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!checkRateLimit(submitLimiter, ip).allowed) {
    return { success: false, errors: { _: ['Too many submissions. Please try again later.'] } };
  }

  const channelsJson = (formData.get('channelsJson') as string) || '[]';
  let parsedChannels: Array<{
    channelType: communityOptions.CommunityChannelType;
    url: string;
    label?: string;
    isPrimary?: boolean;
  }> = [];
  try {
    const rawChannels = JSON.parse(channelsJson) as unknown;
    parsedChannels = Array.isArray(rawChannels)
      ? (rawChannels as Array<{
          channelType: communityOptions.CommunityChannelType;
          url: string;
          label?: string;
          isPrimary?: boolean;
        }>)
      : [];
  } catch {
    parsedChannels = [];
  }

  const raw = {
    name: formData.get('name') as string,
    description: formData.get('description') as string,
    citySlug: formData.get('citySlug') as string,
    categories: formData.getAll('categories') as string[],
    languages: formData.getAll('languages') as string[],
    channels: parsedChannels,
    relationship: (formData.get('relationship') as string) || 'JUST_ADDING',
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

  // Resolve city, dedup-check, and resolve categories - all DB reads that
  // must run before the write. Wrapped together so a cold-start DB error
  // returns a graceful user-facing message instead of a 500.
  let city: {
    id: string;
    slug: string;
    metroRegionId: string | null;
    metroRegion: { slug: string } | null;
  } | null;
  let targetCityId: string;
  let normalizedCitySlug: string;
  let existingCommunities: { name: string }[];
  let categoryRows: { id: string }[];
  let slug: string;
  try {
    city = await db.city.findFirst({
      where: {
        slug: data.citySlug,
        OR: [{ isActive: true }, { metroRegionId: { not: null } }],
      },
      select: {
        id: true,
        slug: true,
        metroRegionId: true,
        metroRegion: { select: { slug: true } },
      },
    });
    if (!city) {
      return { success: false, errors: { citySlug: ['City not found or not active'] } };
    }

    targetCityId = city.metroRegionId ?? city.id;
    normalizedCitySlug = city.metroRegion?.slug ?? city.slug;

    // Dedup check - prevent duplicate submissions
    existingCommunities = await db.community.findMany({
      where: { cityId: targetCityId, status: { not: 'INACTIVE' } },
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
    slug = slugify(data.name, { lower: true, strict: true });
    const existingSlug = await db.community.findUnique({ where: { slug } });
    if (existingSlug) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    // Resolve category IDs
    categoryRows = await db.category.findMany({
      where: { slug: { in: data.categories }, type: 'CATEGORY' },
      select: { id: true },
    });
  } catch {
    return { success: false, errors: { _: ['Something went wrong. Please try again.'] } };
  }

  if (categoryRows.length !== data.categories.length) {
    return {
      success: false,
      errors: { categories: ['One or more selected categories are invalid'] },
    };
  }

  // Build access channels
  const channels: {
    channelType: communityOptions.CommunityChannelType;
    url: string;
    label: string;
    isPrimary: boolean;
  }[] = data.channels.map((channel) => ({
    channelType: channel.channelType,
    url: channel.url,
    label: channel.label?.trim() || channel.channelType,
    isPrimary: channel.isPrimary,
  }));

  // PRD/TDD-0055: classify channel evidence at intake so the admin queue is
  // pre-graded (strong vs weak vs insufficient). Best-effort, never blocks the
  // write — summarizeEvidence is pure and total.
  const sourceEvidence = buildStoredEvidence(channels.map((c) => c.url));

  // Create or resolve a submitter user so createdByUserId is tracked
  let submitterUserId: string | null = null;
  try {
    const email = data.contactEmail.trim().toLowerCase();
    const submitter = await db.user.upsert({
      where: { email },
      update: {
        ...(data.contactName ? { displayName: data.contactName } : {}),
      },
      create: {
        email,
        ...(data.contactName ? { displayName: data.contactName } : {}),
        role: 'USER',
      },
      select: { id: true },
    });
    submitterUserId = submitter.id;
  } catch {
    // best-effort; submission should still proceed even if user upsert fails
  }

  // Create community as UNVERIFIED
  try {
    await db.community.create({
      data: {
        name: data.name,
        slug,
        description: data.description,
        // Normalize satellite submissions to their metro primary city so
        // discovery and scoring stay partitioned by metro.
        cityId: targetCityId,
        languages: data.languages,
        status: 'UNVERIFIED',
        claimState: 'UNCLAIMED',
        createdByUserId: submitterUserId,
        source: 'COMMUNITY_SUBMITTED',
        metadata: {
          submitter: {
            name: data.contactName,
            email: data.contactEmail,
            relationship: data.relationship,
            ownershipIntent: data.relationship === 'HELP_RUN',
            submittedAt: new Date().toISOString(),
            notice: {
              policyVersion: noticePolicyVersion,
              source: 'submit_form',
              recordedAt: noticeRecordedAt,
            },
          },
          city: {
            submittedCitySlug: city.slug,
            normalizedCitySlug,
          },
          sourceEvidence,
          needsReview: sourceEvidence.requiresReview,
        },
        categories: {
          create: categoryRows.map((c) => ({ categoryId: c.id })),
        },
        accessChannels: { create: channels },
      },
    });
  } catch {
    return {
      success: false,
      errors: { _: ['Failed to create community. Please try again.'] },
    };
  }

  // Email is best-effort - don't fail the submission if it doesn't send
  try {
    await sendSubmissionReceivedEmail(data.contactEmail, data.contactName, data.name);
  } catch {
    // silently ignore email failure
  }

  // Analytics - fire-and-forget, non-critical
  // Use 'anonymous' as distinctId for unauthenticated submissions to avoid PII in PostHog
  await captureServerEvent('anonymous-submitter', Events.COMMUNITY_SUBMITTED, {
    city: city.slug,
    normalized_city_slug: normalizedCitySlug,
    channel_types: channels.map((c) => c.channelType.toLowerCase()),
  });

  return { success: true, communityName: data.name };
}
