import { db } from '@/lib/db';
import { refreshCommunityScore } from '@/modules/scoring';
import {
  Prisma,
  type PipelineSourceType,
  type ResourceAudience,
  type ResourceScope,
  type ResourceStage,
  type ResourceType,
} from '@prisma/client';
import slugify from 'slugify';
import {
  parseEventDateTimeInTimeZone,
  formatDateTimeLocalInTimeZone,
  DEFAULT_EVENT_TIMEZONE,
} from '@/lib/datetime/event-timezone';
import type { SourceReliabilityStat } from './reliability';
import type { ExtractedCommunity, ExtractedData, ExtractedEvent, ExtractedResource } from './types';
import {
  DEDUP_QUEUE_SCAN_LIMIT,
  hasStrongEventIdentityEvidence,
  isEventTitleMatch,
  normalizeComparableUrl,
  normalizeEventTitleForDedup,
  normalizeSourceUrlForDedup,
  parseEventStart,
} from './dedup';

type EventDuplicateMatch = {
  eventId: string;
  reason: 'source-url' | 'registration-url' | 'title-date';
};

const RESOURCE_TYPE_VALUES: ReadonlySet<ResourceType> = new Set([
  'CONSULAR_SERVICE',
  'OFFICIAL_EVENT',
  'GOVERNMENT_INFO',
  'VISA_SERVICE',
  'CITY_REGISTRATION',
  'DRIVING',
  'HOUSING',
  'HEALTH_DOCTORS',
  'FAMILY_CHILDREN',
  'JOBS_CAREERS',
  'TAX_FINANCE',
  'BUSINESS_SETUP',
  'GROCERY_FOOD',
  'COMMUNITY_RESOURCE',
]);
const RESOURCE_SCOPE_VALUES: ReadonlySet<ResourceScope> = new Set([
  'GLOBAL',
  'COUNTRY',
  'STATE',
  'METRO',
  'CITY',
  'DISTRICT',
]);
const RESOURCE_AUDIENCE_VALUES: ReadonlySet<ResourceAudience> = new Set([
  'NEWCOMER',
  'FAMILY',
  'FOUNDER',
  'EMPLOYEE',
  'STUDENT',
  'STUDENT_VISA',
  'SENIOR',
  'RETURNEE',
]);
const RESOURCE_STAGE_VALUES: ReadonlySet<ResourceStage> = new Set([
  'PRE_ARRIVAL',
  'FIRST_30_DAYS',
  'FIRST_90_DAYS',
  'SETTLED',
  'ANYTIME',
]);

const COMMUNITY_MATCH_STOPWORDS = new Set([
  'community',
  'commmunity',
  'stuttgart',
  'munich',
  'muenchen',
  'frankfurt',
  'berlin',
  'karlsruhe',
  'mannheim',
  'heidelberg',
  'germany',
  'deutschland',
  'e',
  'v',
  'ev',
  'verein',
  'association',
  'group',
  'community',
]);

const MIN_EVENT_COMMUNITY_MATCH_SCORE = 4;

function normalizeMatchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactMatchText(value: string): string {
  return normalizeMatchText(value).replace(/\s+/g, '');
}

function tokenizeMatchText(value: string): string[] {
  return normalizeMatchText(value)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !COMMUNITY_MATCH_STOPWORDS.has(token));
}

function scoreCommunityMatch(event: ExtractedEvent, communityName: string): number {
  const eventText = [event.title, event.hostCommunity ?? '', event.venueName ?? ''].join(' ');
  const eventCompact = compactMatchText(eventText);
  const communityCompact = compactMatchText(communityName);
  if (!eventCompact || !communityCompact) return 0;

  let score = 0;
  if (eventCompact.includes(communityCompact) || communityCompact.includes(eventCompact)) {
    score += 6;
  }

  const eventTokens = new Set(tokenizeMatchText(eventText));
  const communityTokens = tokenizeMatchText(communityName);
  let overlap = 0;
  for (const token of communityTokens) {
    if (eventTokens.has(token)) overlap += 1;
  }

  score += overlap * 2;

  if (event.hostCommunity) {
    const hostCompact = compactMatchText(event.hostCommunity);
    if (hostCompact && communityCompact.includes(hostCompact)) score += 4;
    if (hostCompact && hostCompact.includes(communityCompact)) score += 4;
  }

  return score;
}

function shouldTrustPreferredCommunityHint(
  event: ExtractedEvent,
  preferredCommunityName?: string,
): boolean {
  if (!event.hostCommunity) return true;
  if (!preferredCommunityName) return false;

  const hostCompact = compactMatchText(event.hostCommunity);
  const preferredCompact = compactMatchText(preferredCommunityName);
  if (!hostCompact || !preferredCompact) return false;

  return (
    hostCompact === preferredCompact ||
    hostCompact.includes(preferredCompact) ||
    preferredCompact.includes(hostCompact)
  );
}

async function findDuplicateEventForApproval(input: {
  event: ExtractedEvent;
  cityId: string;
  sourceUrl?: string | null;
  currentPipelineItemId: string;
}): Promise<EventDuplicateMatch | null> {
  const { event, cityId, sourceUrl, currentPipelineItemId } = input;

  // Resolve the event city's timezone so wall-clock dedup comparisons interpret
  // date/time values in the city's zone rather than the server's local timezone.
  const city = await db.city.findUnique({
    where: { id: cityId },
    select: { timezone: true },
  });
  const timeZone = city?.timezone || DEFAULT_EVENT_TIMEZONE;

  const normalizedIncomingSourceUrl = normalizeSourceUrlForDedup(sourceUrl);
  if (normalizedIncomingSourceUrl) {
    const priorApprovedItems = await db.pipelineItem.findMany({
      where: {
        id: { not: currentPipelineItemId },
        cityId,
        entityType: 'EVENT',
        status: { in: ['APPROVED', 'MERGED'] },
        createdEntityId: { not: null },
        sourceUrl: { not: null },
      },
      select: { sourceUrl: true, createdEntityId: true, extractedData: true },
      orderBy: { reviewedAt: 'desc' },
      take: DEDUP_QUEUE_SCAN_LIMIT,
    });

    const sourceUrlMatch = priorApprovedItems.find((item) => {
      if (normalizeSourceUrlForDedup(item.sourceUrl) !== normalizedIncomingSourceUrl) return false;

      const previous = item.extractedData as unknown as Partial<ExtractedEvent>;
      const sameNormalizedTitle =
        typeof previous.title === 'string' &&
        normalizeEventTitleForDedup(previous.title) === normalizeEventTitleForDedup(event.title);
      const incomingStart = parseEventStart(event.date, event.time, timeZone);
      const previousStart = parseEventStart(previous.date ?? null, previous.time ?? null, timeZone);
      const closeDate =
        incomingStart && previousStart
          ? Math.abs(incomingStart.getTime() - previousStart.getTime()) / (1000 * 60 * 60 * 24) <= 1
          : false;

      return sameNormalizedTitle || closeDate;
    });
    if (sourceUrlMatch?.createdEntityId) {
      return { eventId: sourceUrlMatch.createdEntityId, reason: 'source-url' };
    }
  }

  if (!event.date) return null;

  // Anchor the dedup window to the start of the event day in the city's
  // timezone, then widen by ±1 calendar day. Using the shared timezone helper
  // (instead of a server-local `new Date(...)`) keeps the window stable
  // regardless of the server's local timezone.
  const dayStart = parseEventDateTimeInTimeZone(event.date, '00:00', timeZone);
  if (!dayStart) return null;

  const DAY_MS = 24 * 60 * 60 * 1000;
  const startOfWindow = new Date(dayStart.getTime() - DAY_MS);
  const endOfWindow = new Date(dayStart.getTime() + 2 * DAY_MS - 1);

  const candidates = await db.event.findMany({
    where: {
      cityId,
      startsAt: { gte: startOfWindow, lte: endOfWindow },
    },
    select: {
      id: true,
      title: true,
      registrationUrl: true,
      startsAt: true,
      venueName: true,
      community: { select: { name: true } },
    },
  });

  const incomingRegistrationUrl = normalizeComparableUrl(event.registrationUrl);
  for (const candidate of candidates) {
    const candidateRegistrationUrl = normalizeComparableUrl(candidate.registrationUrl);
    if (
      incomingRegistrationUrl &&
      candidateRegistrationUrl &&
      incomingRegistrationUrl === candidateRegistrationUrl
    ) {
      return { eventId: candidate.id, reason: 'registration-url' };
    }

    const candidateLocal = formatDateTimeLocalInTimeZone(candidate.startsAt, timeZone);
    if (
      isEventTitleMatch(event.title, candidate.title) &&
      hasStrongEventIdentityEvidence(
        {
          title: event.title,
          date: event.date,
          time: event.time,
          venueName: event.venueName,
          hostCommunity: event.hostCommunity,
        },
        {
          title: candidate.title,
          date: candidateLocal.slice(0, 10),
          time: candidateLocal.slice(11, 16),
          venueName: candidate.venueName,
          hostCommunity: candidate.community?.name ?? null,
        },
      )
    ) {
      return { eventId: candidate.id, reason: 'title-date' };
    }
  }

  return null;
}

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

  if (item.type === 'RESOURCE') {
    return { eligible: false, reason: 'resource-admin-approval-required' };
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

async function createEventFromExtraction(
  event: ExtractedEvent,
  cityId: string,
  preferredCommunityId?: string,
  preferredCommunityName?: string,
  provenance?: {
    sourceUrl?: string | null;
    sourceType?: PipelineSourceType;
    pipelineItemId?: string;
  },
): Promise<string> {
  // Resolve the event city's timezone so wall-clock date/time strings are
  // interpreted in the city's zone rather than the server's local timezone.
  const city = await db.city.findUnique({
    where: { id: cityId },
    select: { timezone: true },
  });
  const timeZone = city?.timezone || DEFAULT_EVENT_TIMEZONE;
  const parseDateTime = (dateStr: string, timeStr: string): Date | null =>
    parseEventDateTimeInTimeZone(dateStr, timeStr, timeZone);
  const today = new Date().toISOString().slice(0, 10);
  const safeDate = event.date?.trim() || '';
  const safeTime = event.time?.trim() || '';
  const safeEndDate = event.endDate?.trim() || '';
  const safeEndTime = event.endTime?.trim() || '';

  let startsAt = new Date();
  if (safeDate) {
    const parsedStart = parseDateTime(safeDate, safeTime || '00:00');
    if (parsedStart) startsAt = parsedStart;
  }

  let endsAt: Date | undefined;
  if (safeEndDate || safeEndTime) {
    const endDateStr = safeEndDate || safeDate || today;
    const endTimeStr = safeEndTime || '23:59';
    const parsedEnd = parseDateTime(endDateStr, endTimeStr);
    if (parsedEnd && parsedEnd >= startsAt) {
      endsAt = parsedEnd;
    }
  }

  const candidateCommunities = await db.community.findMany({
    where: { cityId, mergedIntoId: null },
    select: { id: true, name: true },
  });

  let communityId: string | undefined;
  let bestCommunityScore = 0;
  for (const candidate of candidateCommunities) {
    const score = scoreCommunityMatch(event, candidate.name);
    if (score > bestCommunityScore) {
      bestCommunityScore = score;
      communityId = candidate.id;
    }
  }

  if (bestCommunityScore < MIN_EVENT_COMMUNITY_MATCH_SCORE) {
    communityId = undefined;
  }

  if (
    !communityId &&
    preferredCommunityId &&
    shouldTrustPreferredCommunityHint(event, preferredCommunityName)
  ) {
    const preferred = await db.community.findFirst({
      where: { id: preferredCommunityId, cityId, mergedIntoId: null },
      select: { id: true },
    });
    communityId = preferred?.id;
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
      costType: event.costType,
      priceAmount: event.priceAmount,
      priceCurrency: event.priceCurrency,
      costNote: event.costNote,
      accessType: event.accessType,
      requiresRegistration: event.requiresRegistration,
      requiresApproval: event.requiresApproval,
      entryNote: event.entryNote,
      imageUrl: event.imageUrl,
      source: 'IMPORTED',
      status: 'UPCOMING',
      metadata: {
        pipelineExtracted: true,
        pipelineItemId: provenance?.pipelineItemId ?? null,
        pipelineSourceType: provenance?.sourceType ?? null,
        pipelineSourceUrl: provenance?.sourceUrl ?? null,
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
  status: 'ACTIVE' | 'UNVERIFIED' = 'UNVERIFIED',
  suggestedPersonaSegments: string[] = [],
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
      // PRD/TDD-0053: pipeline-suggested persona tags are applied here, at the
      // moment a human approves the item — never auto-written at extraction.
      personaSegments: suggestedPersonaSegments,
      source: 'IMPORTED',
      status,
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

function normalizeResourceType(value: string | null): ResourceType {
  if (value && RESOURCE_TYPE_VALUES.has(value as ResourceType)) {
    return value as ResourceType;
  }
  return 'COMMUNITY_RESOURCE';
}

function normalizeResourceScope(value: string | null): ResourceScope {
  if (value && RESOURCE_SCOPE_VALUES.has(value as ResourceScope)) {
    return value as ResourceScope;
  }
  return 'CITY';
}

function normalizeResourceAudiences(values: string[]): ResourceAudience[] {
  return values.filter((value): value is ResourceAudience =>
    RESOURCE_AUDIENCE_VALUES.has(value as ResourceAudience),
  );
}

function normalizeResourceStages(values: string[]): ResourceStage[] {
  return values.filter((value): value is ResourceStage =>
    RESOURCE_STAGE_VALUES.has(value as ResourceStage),
  );
}

function parseDateOnly(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function createResourceFromExtraction(
  resource: ExtractedResource,
  city: { id: string; slug: string },
): Promise<string> {
  const resourceType = normalizeResourceType(resource.resourceType);
  const scope = normalizeResourceScope(resource.scope);
  const audiences = normalizeResourceAudiences(resource.audiences);
  const lifecycleStage = normalizeResourceStages(resource.lifecycleStage);
  const scopeRegion =
    resource.scopeRegion?.trim() ||
    (scope === 'CITY' || scope === 'METRO' ? city.slug : scope === 'COUNTRY' ? 'DE' : null);
  const cityId = scope === 'CITY' ? city.id : null;
  const baseSlug = slugify(resource.title, { lower: true, strict: true }) || 'resource';
  const slug = `${baseSlug}-${Date.now().toString(36)}`;

  const created = await db.resource.create({
    data: {
      title: resource.title,
      slug,
      resourceType,
      cityId,
      scope,
      scopeRegion,
      audiences,
      lifecycleStage,
      priority: resource.isOfficialSource ? 75 : 55,
      isEssential: resourceType === 'CONSULAR_SERVICE' || resourceType === 'VISA_SERVICE',
      url: resource.url,
      description: resource.description,
      validUntil: parseDateOnly(resource.validUntil),
      source: 'IMPORTED',
      reviewCadenceDays: resource.isOfficialSource ? 120 : 180,
      lastReviewedAt: new Date(),
      metadata: {
        pipelineExtracted: true,
        confidence: resource.confidence,
        isOfficialSource: resource.isOfficialSource,
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

  const data = item.extractedData as unknown as
    | ExtractedEvent
    | ExtractedCommunity
    | ExtractedResource;
  let createdEntityId: string;
  let nextPipelineStatus: 'APPROVED' | 'MERGED' = 'APPROVED';
  let nextMatchedEntityId: string | null = item.matchedEntityId;
  let mergeReason: EventDuplicateMatch['reason'] | null = null;
  let contentLogAction: 'CREATED' | 'UPDATED' = 'CREATED';
  const metadata =
    item.metadata && typeof item.metadata === 'object' && !Array.isArray(item.metadata)
      ? (item.metadata as Record<string, unknown>)
      : null;
  const sourceHints =
    metadata && typeof metadata.sourceHints === 'object' && metadata.sourceHints
      ? (metadata.sourceHints as Record<string, unknown>)
      : null;
  const hintedCommunityId =
    sourceHints && typeof sourceHints.communityId === 'string'
      ? sourceHints.communityId.trim() || undefined
      : undefined;
  const hintedCommunityName =
    sourceHints && typeof sourceHints.communityName === 'string'
      ? sourceHints.communityName.trim() || undefined
      : undefined;
  // PRD/TDD-0053: persona tags the pipeline suggested at extraction time are
  // applied now, on human approval (suggest-only; ADR-0006 L0 gate).
  const suggestedTags =
    metadata && typeof metadata.suggestedTags === 'object' && metadata.suggestedTags
      ? (metadata.suggestedTags as Record<string, unknown>)
      : null;
  const suggestedPersonaSegments =
    suggestedTags && Array.isArray(suggestedTags.personaSegments)
      ? suggestedTags.personaSegments.filter((v): v is string => typeof v === 'string')
      : [];

  if (item.reviewKind === 'ENRICHMENT' && item.entityType === 'COMMUNITY' && item.targetEntityId) {
    createdEntityId = await applyCommunityEnrichmentSuggestion(
      item.targetEntityId,
      data as ExtractedCommunity,
    );
    contentLogAction = 'UPDATED';
  } else if (item.entityType === 'EVENT') {
    const extractedEvent = data as ExtractedEvent;
    const duplicate = await findDuplicateEventForApproval({
      event: extractedEvent,
      cityId: item.cityId,
      sourceUrl: item.sourceUrl,
      currentPipelineItemId: item.id,
    });

    if (duplicate) {
      createdEntityId = duplicate.eventId;
      nextPipelineStatus = 'MERGED';
      nextMatchedEntityId = duplicate.eventId;
      mergeReason = duplicate.reason;
      contentLogAction = 'UPDATED';
    } else {
      createdEntityId = await createEventFromExtraction(
        extractedEvent,
        item.cityId,
        hintedCommunityId,
        hintedCommunityName,
        {
          sourceUrl: item.sourceUrl,
          sourceType: item.sourceType,
          pipelineItemId: item.id,
        },
      );
    }

    const created = await db.event.findUnique({
      where: { id: createdEntityId },
      select: { communityId: true },
    });
    if (created?.communityId) {
      await refreshCommunityScore(created.communityId);
    }
  } else {
    if (item.entityType === 'RESOURCE') {
      createdEntityId = await createResourceFromExtraction(data as ExtractedResource, item.city);
    } else {
      // Admin-approved pipeline items go straight to ACTIVE - they've already
      // been reviewed here. Auto-approved items stay UNVERIFIED so a human
      // still has a chance to vet them before they go public.
      const newStatus: 'ACTIVE' | 'UNVERIFIED' = options.autoApproved ? 'UNVERIFIED' : 'ACTIVE';
      createdEntityId = await createCommunityFromExtraction(
        data as ExtractedCommunity,
        item.cityId,
        newStatus,
        suggestedPersonaSegments,
      );
    }
  }

  await db.pipelineItem.update({
    where: { id },
    data: {
      status: nextPipelineStatus,
      reviewedAt: new Date(),
      reviewedBy,
      createdEntityId,
      matchedEntityId: nextMatchedEntityId,
      autoApproved: options.autoApproved ?? false,
      autoApprovalReason: options.autoApprovalReason ?? null,
      reviewNotes:
        nextPipelineStatus === 'MERGED'
          ? `Merged at approval: duplicate event resolved by ${mergeReason ?? 'dedup'} check.`
          : item.reviewNotes,
    },
  });

  if (item.entityType === 'COMMUNITY') {
    await refreshCommunityScore(createdEntityId);
  }

  // TDD-0045: when a NEW event is approved (not merged as duplicate), bump lastActivityAt
  // on the linked community so DB-level recency queries stay current without waiting for cron.
  if (item.entityType === 'EVENT' && nextPipelineStatus === 'APPROVED') {
    const approvedEvent = await db.event.findUnique({
      where: { id: createdEntityId },
      select: { communityId: true, moderationState: true },
    });
    if (approvedEvent?.communityId && approvedEvent.moderationState === 'PUBLISHED') {
      await db.community.update({
        where: { id: approvedEvent.communityId },
        data: { lastActivityAt: new Date() },
      });
      await refreshCommunityScore(approvedEvent.communityId);
    }
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
        pipelineStatus: nextPipelineStatus,
        sourceType: item.sourceType,
        sourceUrl: item.sourceUrl,
        confidence: item.confidence,
        autoApproved: options.autoApproved ?? false,
        autoApprovalReason: options.autoApprovalReason ?? null,
        mergedDuplicateReason: mergeReason,
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
    } else if (item.entityType === 'RESOURCE') {
      await db.resource.deleteMany({ where: { id: item.createdEntityId, source: 'IMPORTED' } });
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
