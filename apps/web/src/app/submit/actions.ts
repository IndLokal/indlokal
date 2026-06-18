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
import { readCommunityCoreFormData } from '@/lib/communities/form-input';
import { getSessionUser } from '@/lib/session';

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

  // PRD/TDD-0060: attribution is session-first. When a user is signed in, the
  // contribution binds to their account; the typed contact email is communication
  // metadata only and is never used to derive (or create) the actor account.
  const sessionUser = await getSessionUser();

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

  const core = readCommunityCoreFormData(formData);

  const raw = {
    name: core.name,
    description: core.description,
    citySlug: formData.get('citySlug') as string,
    categories: formData.getAll('categories') as string[],
    languages: core.languages,
    channels: parsedChannels,
    relationship: (formData.get('relationship') as string) || 'JUST_ADDING',
    // Logged-in UI omits contact inputs entirely; normalize missing values so
    // schema parsing remains stable and session-first contact resolution runs.
    contactEmail: (formData.get('contactEmail') as string | null) ?? '',
    contactName: (formData.get('contactName') as string | null) ?? '',
  };

  const parsed = submitCommunitySchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const data = parsed.data;

  // PRD/TDD-0060: contact is session-first. Authenticated users contribute as
  // their account (contact = account email, name = account display name) and the
  // form never asks for a separate contact. Anonymous submitters must provide an
  // email so we can send the receipt and follow up. The typed contact email is
  // never used to attribute the contribution (that is `submitterUserId` below).
  const resolvedContactEmail = (sessionUser?.email ?? data.contactEmail ?? '').trim();
  const resolvedContactName = (sessionUser?.displayName ?? data.contactName ?? '').trim();
  if (!resolvedContactEmail) {
    return {
      success: false,
      errors: { contactEmail: ['Please enter your email so we can follow up.'] },
    };
  }

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

  // PRD/TDD-0060: attribute to the authenticated actor only. Anonymous
  // submissions stay unattributed (createdByUserId: null) and rely on the
  // contact email retained in metadata.submitter for follow-up — we no longer
  // create ghost User rows from a typed contact email.
  const submitterUserId: string | null = sessionUser?.id ?? null;

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
            name: resolvedContactName || null,
            email: resolvedContactEmail,
            relationship: data.relationship,
            // Legacy note: older rows may still include submitter.ownershipIntent.
            // New submissions use relationship as the single source of intent.
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
    await sendSubmissionReceivedEmail(resolvedContactEmail, resolvedContactName, data.name);
  } catch {
    // silently ignore email failure
  }

  // Analytics - fire-and-forget, non-critical
  // Attribute to the session user when signed in; otherwise 'anonymous-submitter'
  // to avoid PII in PostHog.
  await captureServerEvent(sessionUser?.id ?? 'anonymous-submitter', Events.COMMUNITY_SUBMITTED, {
    city: city.slug,
    normalized_city_slug: normalizedCitySlug,
    channel_types: channels.map((c) => c.channelType.toLowerCase()),
  });

  return { success: true, communityName: data.name };
}
