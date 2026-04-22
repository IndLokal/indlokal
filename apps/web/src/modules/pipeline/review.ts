import { db } from '@/lib/db';
import { refreshCommunityScore } from '@/modules/scoring';
import { Prisma, type PipelineSourceType } from '@prisma/client';
import slugify from 'slugify';
import type { SourceReliabilityStat } from './reliability';
import type { ExtractedCommunity, ExtractedData, ExtractedEvent } from './types';

export function shouldAutoApprovePipelineItem(input: {
  item: ExtractedData;
  sourceType: PipelineSourceType;
  reliability: SourceReliabilityStat | undefined;
  matchedEntityId: string | null;
  matchScore: number | null;
}): { eligible: boolean; reason: string } {
  const { item, reliability, matchedEntityId, matchScore } = input;
  if (matchedEntityId || (matchScore ?? 0) > 0) {
    return { eligible: false, reason: 'matched-existing-entity' };
  }
  if (!reliability || reliability.totalReviewed < 5 || reliability.approvalRate < 0.8) {
    return { eligible: false, reason: 'source-not-trusted-yet' };
  }
  if (item.confidence < 0.9) {
    return { eligible: false, reason: 'confidence-below-threshold' };
  }

  if (item.type === 'EVENT') {
    if (!item.title || !item.date) return { eligible: false, reason: 'event-missing-core-fields' };
    if (!item.registrationUrl && !item.venueName && !item.hostCommunity) {
      return { eligible: false, reason: 'event-too-sparse' };
    }
    return { eligible: true, reason: 'trusted-source-high-confidence-event' };
  }

  const hasAccessChannel = Boolean(
    item.websiteUrl ||
    item.facebookUrl ||
    item.instagramUrl ||
    item.whatsappUrl ||
    item.telegramUrl,
  );
  if (!item.name || !item.description || item.categories.length === 0 || !hasAccessChannel) {
    return { eligible: false, reason: 'community-missing-core-fields' };
  }

  return { eligible: true, reason: 'trusted-source-high-confidence-community' };
}

function buildAccessChannels(community: ExtractedCommunity): Array<{
  channelType: 'WEBSITE' | 'FACEBOOK' | 'INSTAGRAM' | 'WHATSAPP' | 'TELEGRAM' | 'EMAIL';
  url: string;
  isPrimary: boolean;
}> {
  const channels: Array<{
    channelType: 'WEBSITE' | 'FACEBOOK' | 'INSTAGRAM' | 'WHATSAPP' | 'TELEGRAM' | 'EMAIL';
    url: string;
    isPrimary: boolean;
  }> = [];
  let hasPrimary = false;

  if (community.websiteUrl) {
    channels.push({ channelType: 'WEBSITE', url: community.websiteUrl, isPrimary: !hasPrimary });
    hasPrimary = true;
  }
  if (community.facebookUrl) {
    channels.push({ channelType: 'FACEBOOK', url: community.facebookUrl, isPrimary: !hasPrimary });
    hasPrimary = true;
  }
  if (community.instagramUrl) {
    channels.push({
      channelType: 'INSTAGRAM',
      url: community.instagramUrl,
      isPrimary: !hasPrimary,
    });
    hasPrimary = true;
  }
  if (community.whatsappUrl) {
    channels.push({ channelType: 'WHATSAPP', url: community.whatsappUrl, isPrimary: !hasPrimary });
    hasPrimary = true;
  }
  if (community.telegramUrl) {
    channels.push({ channelType: 'TELEGRAM', url: community.telegramUrl, isPrimary: !hasPrimary });
    hasPrimary = true;
  }
  if (community.contactEmail) {
    channels.push({ channelType: 'EMAIL', url: community.contactEmail, isPrimary: !hasPrimary });
  }

  return channels;
}

async function createEventFromExtraction(event: ExtractedEvent, cityId: string): Promise<string> {
  let startsAt: Date;
  if (event.date) {
    const timeStr = event.time ?? '00:00';
    startsAt = new Date(`${event.date}T${timeStr}:00`);
  } else {
    startsAt = new Date();
  }

  let endsAt: Date | undefined;
  if (event.endDate || event.endTime) {
    const endDateStr = event.endDate ?? event.date ?? new Date().toISOString().slice(0, 10);
    const endTimeStr = event.endTime ?? '23:59';
    endsAt = new Date(`${endDateStr}T${endTimeStr}:00`);
  }

  let communityId: string | undefined;
  if (event.hostCommunity) {
    const match = await db.community.findFirst({
      where: {
        cityId,
        name: { contains: event.hostCommunity, mode: 'insensitive' },
        mergedIntoId: null,
      },
      select: { id: true },
    });
    communityId = match?.id;
  }

  const categoryRecords = await db.category.findMany({
    where: { slug: { in: event.categories } },
    select: { id: true },
  });

  const slug = `${slugify(event.title, { lower: true, strict: true })}-${Date.now().toString(36)}`;

  const created = await db.event.create({
    data: {
      title: event.title,
      slug,
      description: event.description,
      cityId,
      communityId,
      venueName: event.venueName,
      venueAddress: event.venueAddress,
      startsAt,
      endsAt,
      isOnline: event.isOnline,
      registrationUrl: event.registrationUrl,
      cost: event.isFree ? 'free' : (event.cost ?? 'unclear'),
      imageUrl: event.imageUrl,
      source: 'IMPORTED',
      status: 'UPCOMING',
      metadata: {
        pipelineExtracted: true,
        confidence: event.confidence,
        languages: event.languages,
      },
      categories: {
        create: categoryRecords.map((c) => ({ categoryId: c.id })),
      },
    },
  });

  return created.id;
}

async function createCommunityFromExtraction(
  community: ExtractedCommunity,
  cityId: string,
): Promise<string> {
  const categoryRecords = await db.category.findMany({
    where: { slug: { in: community.categories } },
    select: { id: true },
  });

  const slug = `${slugify(community.name, { lower: true, strict: true })}-${Date.now().toString(36)}`;

  const created = await db.community.create({
    data: {
      name: community.name,
      slug,
      description: community.description,
      cityId,
      languages: community.languages,
      source: 'IMPORTED',
      status: 'UNVERIFIED',
      metadata: {
        pipelineExtracted: true,
        confidence: community.confidence,
      },
      categories: {
        create: categoryRecords.map((c) => ({ categoryId: c.id })),
      },
      accessChannels: {
        create: buildAccessChannels(community),
      },
    },
  });

  return created.id;
}

async function applyCommunityEnrichmentSuggestion(
  communityId: string,
  suggestion: ExtractedCommunity,
): Promise<string> {
  const existing = await db.community.findUnique({
    where: { id: communityId },
    include: {
      categories: { select: { categoryId: true } },
      accessChannels: { select: { channelType: true, url: true } },
    },
  });
  if (!existing) {
    throw new Error('Target community not found for enrichment suggestion');
  }

  const categoryRecords = await db.category.findMany({
    where: { slug: { in: suggestion.categories } },
    select: { id: true },
  });
  const existingCategoryIds = new Set(existing.categories.map((category) => category.categoryId));
  const channels = buildAccessChannels(suggestion);
  const existingChannelKeys = new Set(
    existing.accessChannels.map((channel) => `${channel.channelType}:${channel.url.toLowerCase()}`),
  );

  const metadata =
    existing.metadata && typeof existing.metadata === 'object' && !Array.isArray(existing.metadata)
      ? (existing.metadata as Record<string, unknown>)
      : {};

  await db.community.update({
    where: { id: communityId },
    data: {
      description: suggestion.description ?? existing.description,
      languages: [...new Set([...existing.languages, ...suggestion.languages])],
      lastEnrichedAt: new Date(),
      metadata: {
        ...metadata,
        enrichment: {
          lastAppliedAt: new Date().toISOString(),
          confidence: suggestion.confidence,
        },
      } as Prisma.InputJsonValue,
      categories: {
        create: categoryRecords
          .filter((category) => !existingCategoryIds.has(category.id))
          .map((category) => ({ categoryId: category.id })),
      },
      accessChannels: {
        create: channels
          .filter(
            (channel) =>
              !existingChannelKeys.has(`${channel.channelType}:${channel.url.toLowerCase()}`),
          )
          .map((channel) => ({ ...channel, label: channel.channelType })),
      },
    },
  });

  return communityId;
}

export async function approvePipelineItemRecord(
  id: string,
  options: { reviewedBy?: string; autoApproved?: boolean; autoApprovalReason?: string } = {},
) {
  const reviewedBy = options.reviewedBy ?? 'admin';

  const item = await db.pipelineItem.findUnique({
    where: { id },
    include: { city: { select: { id: true, slug: true } } },
  });

  if (!item || item.status !== 'PENDING') return null;

  const data = item.extractedData as unknown as ExtractedEvent | ExtractedCommunity;
  let createdEntityId: string;
  let contentLogAction: 'CREATED' | 'UPDATED' = 'CREATED';

  if (item.reviewKind === 'ENRICHMENT' && item.entityType === 'COMMUNITY' && item.targetEntityId) {
    createdEntityId = await applyCommunityEnrichmentSuggestion(
      item.targetEntityId,
      data as ExtractedCommunity,
    );
    contentLogAction = 'UPDATED';
  } else if (item.entityType === 'EVENT') {
    createdEntityId = await createEventFromExtraction(data as ExtractedEvent, item.cityId);

    const created = await db.event.findUnique({
      where: { id: createdEntityId },
      select: { communityId: true },
    });
    if (created?.communityId) {
      await refreshCommunityScore(created.communityId);
    }
  } else {
    createdEntityId = await createCommunityFromExtraction(data as ExtractedCommunity, item.cityId);
  }

  await db.pipelineItem.update({
    where: { id },
    data: {
      status: 'APPROVED',
      reviewedAt: new Date(),
      reviewedBy,
      createdEntityId,
      autoApproved: options.autoApproved ?? false,
      autoApprovalReason: options.autoApprovalReason ?? null,
    },
  });

  if (item.entityType === 'COMMUNITY') {
    await refreshCommunityScore(createdEntityId);
  }

  await db.contentLog.create({
    data: {
      entityType: item.entityType.toLowerCase(),
      entityId: createdEntityId,
      action: contentLogAction,
      source: 'IMPORTED',
      changedBy: reviewedBy,
      metadata: {
        pipeline: true,
        reviewKind: item.reviewKind,
        sourceType: item.sourceType,
        sourceUrl: item.sourceUrl,
        confidence: item.confidence,
        autoApproved: options.autoApproved ?? false,
        autoApprovalReason: options.autoApprovalReason ?? null,
      } as Prisma.InputJsonValue,
    },
  });

  return { itemId: id, createdEntityId, entityType: item.entityType, citySlug: item.city.slug };
}

export async function revertAutoApprovedPipelineItems(ids: string[], reviewedBy = 'admin') {
  const items = await db.pipelineItem.findMany({
    where: {
      id: { in: ids },
      autoApproved: true,
      status: 'APPROVED',
      reviewKind: 'DISCOVERY',
    },
    select: {
      id: true,
      entityType: true,
      createdEntityId: true,
    },
  });

  let reverted = 0;
  for (const item of items) {
    if (!item.createdEntityId) continue;

    if (item.entityType === 'EVENT') {
      await db.event.deleteMany({ where: { id: item.createdEntityId, source: 'IMPORTED' } });
    } else {
      await db.community.deleteMany({
        where: {
          id: item.createdEntityId,
          source: 'IMPORTED',
          claimState: 'UNCLAIMED',
        },
      });
    }

    await db.pipelineItem.update({
      where: { id: item.id },
      data: {
        status: 'PENDING',
        reviewedAt: null,
        reviewedBy: null,
        createdEntityId: null,
        autoApproved: false,
        autoApprovalReason: null,
        reviewNotes: `Auto-approval reverted by ${reviewedBy}`,
      },
    });

    reverted++;
  }

  return { reverted };
}
