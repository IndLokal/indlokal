/**
 * Enrichment intelligence helpers for post-discovery quality improvements.
 *
 * Responsibilities:
 * - Semantic duplicate tie-break checks for borderline community matches
 * - Community enrichment suggestion generation from canonical source pages
 * - Relationship graph inference (same organizer, sister chapter)
 * - Dynamic keyword mining from approved pipeline outcomes
 *
 * This module intentionally stays lightweight: schema/domain values come from
 * Prisma enums where available, and only local heuristics stay file-local.
 */

import { db } from '@/lib/db';
import { CATEGORIES } from '@/lib/config';
import {
  CommunityStatus,
  KeywordSuggestionStatus,
  PipelineEntityType,
  PipelineItemStatus,
  PipelineReviewKind,
  PipelineSourceType,
  Prisma,
  RelationshipType,
} from '@prisma/client';
import { callOpenAI, htmlToText } from '../llm';
import { SOURCE_LANES, getRuntimeLaneKeywordSeeds } from '../config/runtime-config';
import { PIPELINE_USER_AGENT, fetchTextWithFallback } from '../fetch/http';
import type { ExtractedCommunity, SourceLane } from '../types';

export type ApprovedDynamicKeywordsByLane = {
  byLane: Record<SourceLane, string[]>;
};

const SOURCE_LANE_SET = new Set<SourceLane>(SOURCE_LANES);

/** Minimum confidence required to accept an LLM semantic duplicate match. */
const SEMANTIC_DUPLICATE_MIN_CONFIDENCE = 0.8;

/** Max bytes of fetched source text to keep for enrichment prompts. */
const ENRICHMENT_SOURCE_TEXT_MAX_CHARS = 12_000;

/** HTTP timeout for enrichment source fetches. */
const ENRICHMENT_SOURCE_FETCH_TIMEOUT_MS = 15_000;

/** Re-enrich stale communities no more often than this many days. */
const ENRICHMENT_LOOKBACK_DAYS = 30;

/** Candidate pool size for keyword mining from reviewed items. */
const KEYWORD_MINING_APPROVED_SAMPLE_SIZE = 200;

/** Default confidence applied when keyword-eval LLM omits confidence. */
const KEYWORD_CONFIDENCE_FALLBACK = 0.6;

/** Number of evidence snippets to store per candidate phrase. */
const KEYWORD_EVIDENCE_SNIPPET_LIMIT = 3;

/** Candidate phrases must appear at least this many times to be evaluated. */
const KEYWORD_MIN_OCCURRENCE_COUNT = 2;

/** Max candidate phrases sent to keyword evaluation LLM. */
const KEYWORD_CANDIDATE_LIMIT = 30;

/** Lower/upper tokenized phrase lengths for candidate extraction. */
const KEYWORD_PHRASE_MIN_LENGTH = 4;
const KEYWORD_PHRASE_MAX_LENGTH = 32;

const SEMANTIC_DUPLICATE_PROMPT = `You compare community records and decide whether they refer to the same real-world organization.

Return JSON:
{"matches": [{"id":"candidate-id", "sameEntity": true, "confidence": 0.91, "reason": "..."}]}

Rules:
- sameEntity=true only if they are the same organization, not merely related chapters.
- Student associations, sangams, mandals, temples, and WhatsApp groups can be the same entity even if descriptions differ.
- If they appear to be sister chapters or related but distinct, sameEntity must be false.
- Confidence is 0-1.`;

const ENRICHMENT_PROMPT = `You generate enrichment suggestions for a sparse community profile.

Return JSON:
{"community": {"type":"COMMUNITY", "name":"...", "description":"...", "cityName":"...", "categories":[...], "languages":[...], "websiteUrl":null, "facebookUrl":null, "instagramUrl":null, "whatsappUrl":null, "telegramUrl":null, "contactEmail":null, "confidence":0.82, "fieldConfidence": {"description":0.9}}}

Rules:
- Use only category slugs from this list: ${CATEGORIES.join(', ')}
- Preserve the existing entity identity; do not invent a new community name.
- Prefer null over speculation.
- Produce useful long-form description text when enough evidence exists.`;

const KEYWORD_EVAL_PROMPT = `You evaluate keyword candidates for IndLokal, a platform for Indian/South Asian diaspora discovery.

Return JSON:
{"suggestions": [{"keyword": "Tamil New Year", "accepted": true, "lane": "EVENT", "confidence": 0.9, "reason": "high-signal festival/community term"}]}

Accept terms that are strong diaspora search intents: regional communities, festivals, organization forms, diaspora events, consular services, or high-signal cultural phrases.
For accepted suggestions, always assign exactly one lane: EVENT, COMMUNITY, or RESOURCE.
Reject generic words, cities, person names, and low-signal noise.`;

function normalizeKeyword(keyword: string): string {
  return keyword.trim().toLowerCase().replace(/\s+/g, ' ');
}

function isSourceLane(value: string | null | undefined): value is SourceLane {
  return typeof value === 'string' && SOURCE_LANE_SET.has(value as SourceLane);
}

function getKeywordLaneFromEntityType(entityType: string): SourceLane | null {
  if (entityType === PipelineEntityType.EVENT) return 'EVENT';
  if (entityType === PipelineEntityType.COMMUNITY) return 'COMMUNITY';
  if (entityType === PipelineEntityType.RESOURCE) return 'RESOURCE';
  return null;
}

function resolveDominantKeywordLane(
  laneCounts: Partial<Record<SourceLane, number>>,
): SourceLane | null {
  const ranked = SOURCE_LANES.map((lane) => ({ lane, count: laneCounts[lane] ?? 0 }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count);

  if (ranked.length === 0) return null;
  if (ranked.length > 1 && ranked[0]?.count === ranked[1]?.count) return null;
  return ranked[0]?.lane ?? null;
}

const BASE_STOPWORDS = new Set([
  'india',
  'indian',
  'germany',
  'german',
  'community',
  'event',
  'events',
  'group',
  'association',
  'the',
  'and',
  'for',
  'with',
  'from',
]);

function buildDynamicBlockedTerms(
  cityNames: string[],
  baselineKeywordSet: ReadonlySet<string>,
): Set<string> {
  const blocked = new Set<string>([...BASE_STOPWORDS, ...baselineKeywordSet]);
  for (const cityName of cityNames) {
    const normalized = normalizeKeyword(cityName);
    if (normalized) blocked.add(normalized);
  }

  const currentYear = new Date().getFullYear();
  blocked.add(String(currentYear));
  blocked.add(String(currentYear + 1));

  return blocked;
}

export async function semanticCommunityDuplicateCheck(
  incoming: ExtractedCommunity,
  candidates: Array<{ id: string; name: string; description: string | null; cityName: string }>,
): Promise<{ matchedId: string; confidence: number; reason: string } | null> {
  if (candidates.length === 0) return null;

  const userPrompt = JSON.stringify(
    {
      incoming,
      candidates,
    },
    null,
    2,
  );

  try {
    const response = await callOpenAI(
      [
        { role: 'system', content: SEMANTIC_DUPLICATE_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      { maxTokens: 900 },
    );
    const parsed = JSON.parse(response) as {
      matches?: Array<{ id?: string; sameEntity?: boolean; confidence?: number; reason?: string }>;
    };

    const best = (parsed.matches ?? [])
      .filter((match) => match.sameEntity && typeof match.id === 'string')
      .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0];

    if (!best || (best.confidence ?? 0) < SEMANTIC_DUPLICATE_MIN_CONFIDENCE) return null;

    return {
      matchedId: best.id as string,
      confidence: Math.round((best.confidence ?? 0) * 100) / 100,
      reason: String(best.reason ?? 'semantic-match'),
    };
  } catch (error) {
    console.error('[Pipeline] Semantic duplicate check failed:', String(error));
    return null;
  }
}

function stripHtml(input: string): string {
  return htmlToText(input);
}

async function fetchSourceText(url: string): Promise<string | null> {
  try {
    const response = await fetchTextWithFallback(url, {
      headers: { 'User-Agent': PIPELINE_USER_AGENT },
      timeoutMs: ENRICHMENT_SOURCE_FETCH_TIMEOUT_MS,
    });
    if (!response.ok) return null;
    const text = response.text;
    const cleaned = stripHtml(text);
    return cleaned.slice(0, ENRICHMENT_SOURCE_TEXT_MAX_CHARS);
  } catch {
    return null;
  }
}

export async function enrichSparseCommunities(limit = 10) {
  const staleThreshold = new Date(Date.now() - ENRICHMENT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const communities = await db.community.findMany({
    where: {
      status: { in: [CommunityStatus.ACTIVE, CommunityStatus.CLAIMED, CommunityStatus.UNVERIFIED] },
      mergedIntoId: null,
      completenessScore: { lt: 40 },
      OR: [{ lastEnrichedAt: null }, { lastEnrichedAt: { lt: staleThreshold } }],
    },
    select: {
      id: true,
      name: true,
      description: true,
      languages: true,
      cityId: true,
      city: { select: { name: true } },
      accessChannels: { select: { channelType: true, url: true, isPrimary: true } },
    },
    take: limit,
    orderBy: [{ completenessScore: 'asc' }, { updatedAt: 'asc' }],
  });

  let queued = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const community of communities) {
    const existingPending = await db.pipelineItem.findFirst({
      where: {
        reviewKind: PipelineReviewKind.ENRICHMENT,
        status: PipelineItemStatus.PENDING,
        targetEntityId: community.id,
      },
      select: { id: true },
    });
    if (existingPending) {
      skipped++;
      continue;
    }

    const source =
      community.accessChannels.find((channel) => channel.channelType === 'WEBSITE') ??
      community.accessChannels.find((channel) => channel.isPrimary) ??
      community.accessChannels[0];
    if (!source) {
      skipped++;
      continue;
    }

    const sourceText = await fetchSourceText(source.url);
    if (!sourceText) {
      skipped++;
      continue;
    }

    try {
      const response = await callOpenAI(
        [
          { role: 'system', content: ENRICHMENT_PROMPT },
          {
            role: 'user',
            content: JSON.stringify(
              {
                community: {
                  name: community.name,
                  cityName: community.city.name,
                  description: community.description,
                  languages: community.languages,
                },
                sourceUrl: source.url,
                sourceText,
              },
              null,
              2,
            ),
          },
        ],
        { maxTokens: 1600 },
      );
      const parsed = JSON.parse(response) as { community?: Record<string, unknown> };
      if (!parsed.community) {
        skipped++;
        continue;
      }

      const suggestion: ExtractedCommunity = {
        type: 'COMMUNITY',
        name: String(parsed.community.name ?? community.name),
        description: parsed.community.description ? String(parsed.community.description) : null,
        cityName: String(parsed.community.cityName ?? community.city.name),
        categories: Array.isArray(parsed.community.categories)
          ? parsed.community.categories.filter(
              (value): value is string => typeof value === 'string',
            )
          : [],
        languages: Array.isArray(parsed.community.languages)
          ? parsed.community.languages.filter((value): value is string => typeof value === 'string')
          : [],
        websiteUrl: parsed.community.websiteUrl ? String(parsed.community.websiteUrl) : null,
        facebookUrl: parsed.community.facebookUrl ? String(parsed.community.facebookUrl) : null,
        instagramUrl: parsed.community.instagramUrl ? String(parsed.community.instagramUrl) : null,
        whatsappUrl: parsed.community.whatsappUrl ? String(parsed.community.whatsappUrl) : null,
        telegramUrl: parsed.community.telegramUrl ? String(parsed.community.telegramUrl) : null,
        contactEmail: parsed.community.contactEmail ? String(parsed.community.contactEmail) : null,
        confidence:
          typeof parsed.community.confidence === 'number' ? parsed.community.confidence : 0.75,
        fieldConfidence:
          parsed.community.fieldConfidence && typeof parsed.community.fieldConfidence === 'object'
            ? (parsed.community.fieldConfidence as Record<string, number>)
            : { description: 0.8 },
      };

      await db.pipelineItem.create({
        data: {
          entityType: PipelineEntityType.COMMUNITY,
          reviewKind: PipelineReviewKind.ENRICHMENT,
          sourceType: PipelineSourceType.DB_COMMUNITY,
          sourceUrl: source.url,
          rawContent: sourceText,
          extractedData: suggestion as unknown as Prisma.InputJsonValue,
          confidence: suggestion.confidence,
          cityId: community.cityId,
          matchedEntityId: community.id,
          matchScore: 1,
          targetEntityId: community.id,
          reviewNotes: `Enrichment suggestion for ${community.name}`,
        },
      });

      await db.community.update({
        where: { id: community.id },
        data: { lastEnrichedAt: new Date() },
      });
      queued++;
    } catch (error) {
      errors.push(`${community.name}: ${String(error)}`);
    }
  }

  return { queued, skipped, errors };
}

function normalizeFamilyName(name: string, cityNames: string[]): string {
  const cityPattern = cityNames
    .map((city) => city.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  const withoutCityTerms = cityPattern
    ? name.toLowerCase().replace(new RegExp(`\\b(${cityPattern})\\b`, 'g'), ' ')
    : name.toLowerCase();

  return withoutCityTerms
    .replace(
      /\b(e\.v\.|ev|verein|chapter|group|community|association|samaj|sangam|sangha|mandal|sabha)\b/g,
      ' ',
    )
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function inferCommunityRelationships() {
  const communities = await db.community.findMany({
    where: { mergedIntoId: null, status: { not: CommunityStatus.INACTIVE } },
    select: {
      id: true,
      name: true,
      cityId: true,
      city: { select: { name: true } },
      claimedByUserId: true,
    },
  });

  let sameOrganizer = 0;
  let sisterChapters = 0;
  const cityNames = [...new Set(communities.map((community) => community.city.name))];

  const upsertEdge = async (
    sourceCommunityId: string,
    targetCommunityId: string,
    relationshipType: RelationshipType,
    strength: number,
    metadata: Record<string, unknown>,
  ) => {
    await db.relationshipEdge.upsert({
      where: {
        sourceCommunityId_targetCommunityId_relationshipType: {
          sourceCommunityId,
          targetCommunityId,
          relationshipType,
        },
      },
      create: {
        sourceCommunityId,
        targetCommunityId,
        relationshipType,
        strength,
        metadata: metadata as Prisma.InputJsonValue,
      },
      update: {
        strength,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  };

  const claimedMap = new Map<string, typeof communities>();
  for (const community of communities) {
    if (!community.claimedByUserId) continue;
    claimedMap.set(community.claimedByUserId, [
      ...(claimedMap.get(community.claimedByUserId) ?? []),
      community,
    ]);
  }

  for (const group of claimedMap.values()) {
    if (group.length < 2) continue;
    for (const source of group) {
      for (const target of group) {
        if (source.id === target.id) continue;
        await upsertEdge(source.id, target.id, RelationshipType.SAME_ORGANIZER, 0.95, {
          inferred: true,
          source: 'claimedByUserId',
        });
        sameOrganizer++;
      }
    }
  }

  for (const source of communities) {
    const sourceFamily = normalizeFamilyName(source.name, cityNames);
    if (!sourceFamily || sourceFamily.length < 4) continue;

    for (const target of communities) {
      if (source.id === target.id || source.cityId === target.cityId) continue;
      const targetFamily = normalizeFamilyName(target.name, cityNames);
      if (!targetFamily || sourceFamily !== targetFamily) continue;

      await upsertEdge(source.id, target.id, RelationshipType.SISTER_CHAPTER, 0.75, {
        inferred: true,
        source: 'normalized-name',
        normalizedFamily: sourceFamily,
      });
      sisterChapters++;
    }
  }

  return { sameOrganizer, sisterChapters };
}

function extractCandidateKeywords(
  items: Array<{ text: string; lane: SourceLane | null }>,
  blockedTerms: ReadonlySet<string>,
): Array<{ keyword: string; count: number; evidence: string[]; lane: SourceLane | null }> {
  const counts = new Map<
    string,
    {
      count: number;
      evidence: string[];
      laneCounts: Partial<Record<SourceLane, number>>;
    }
  >();

  for (const item of items) {
    const tokens = item.text
      .replace(/[^a-zA-Z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);

    for (let size = 1; size <= 3; size++) {
      for (let index = 0; index <= tokens.length - size; index++) {
        const phrase = tokens
          .slice(index, index + size)
          .join(' ')
          .trim();
        const normalized = normalizeKeyword(phrase);
        if (normalized.length < KEYWORD_PHRASE_MIN_LENGTH) continue;
        if (normalized.length > KEYWORD_PHRASE_MAX_LENGTH) continue;
        if (blockedTerms.has(normalized)) continue;
        if (/^\d+$/.test(normalized)) continue;

        const entry = counts.get(normalized) ?? { count: 0, evidence: [], laneCounts: {} };
        entry.count += 1;
        if (entry.evidence.length < KEYWORD_EVIDENCE_SNIPPET_LIMIT) {
          entry.evidence.push(item.text.slice(0, 120));
        }
        if (item.lane) {
          entry.laneCounts[item.lane] = (entry.laneCounts[item.lane] ?? 0) + 1;
        }
        counts.set(normalized, entry);
      }
    }
  }

  return [...counts.entries()]
    .filter(([, entry]) => entry.count >= KEYWORD_MIN_OCCURRENCE_COUNT)
    .map(([keyword, entry]) => ({
      keyword,
      count: entry.count,
      evidence: entry.evidence,
      lane: resolveDominantKeywordLane(entry.laneCounts),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, KEYWORD_CANDIDATE_LIMIT);
}

export async function refreshKeywordSuggestions() {
  const laneKeywordSeeds = await getRuntimeLaneKeywordSeeds();
  const baselineKeywordSet = new Set(
    Object.values(laneKeywordSeeds.byLane)
      .flatMap((keywords) => keywords ?? [])
      .map(normalizeKeyword),
  );
  const cityRows = await db.city.findMany({ select: { name: true } });
  const blockedTerms = buildDynamicBlockedTerms(
    cityRows.map((city) => city.name),
    baselineKeywordSet,
  );

  const approvedItems = await db.pipelineItem.findMany({
    where: { status: PipelineItemStatus.APPROVED },
    select: { extractedData: true, entityType: true },
    take: KEYWORD_MINING_APPROVED_SAMPLE_SIZE,
    orderBy: { reviewedAt: 'desc' },
  });

  const texts = approvedItems
    .map((item) => {
      const data = item.extractedData as unknown as Record<string, unknown>;
      const text = [
        data.name,
        data.title,
        data.description,
        ...(Array.isArray(data.categories) ? data.categories : []),
      ]
        .filter((value): value is string => typeof value === 'string')
        .join(' ');
      return { text, lane: getKeywordLaneFromEntityType(item.entityType) };
    })
    .filter((item) => item.text.trim().length > 0);

  const candidates = extractCandidateKeywords(texts, blockedTerms);
  if (candidates.length === 0) {
    return { created: 0, updated: 0, candidates: 0 };
  }

  const response = await callOpenAI(
    [
      { role: 'system', content: KEYWORD_EVAL_PROMPT },
      { role: 'user', content: JSON.stringify({ candidates }, null, 2) },
    ],
    { maxTokens: 1200 },
  );

  const parsed = JSON.parse(response) as {
    suggestions?: Array<{
      keyword?: string;
      accepted?: boolean;
      lane?: string;
      confidence?: number;
      reason?: string;
    }>;
  };

  let created = 0;
  let updated = 0;

  for (const suggestion of parsed.suggestions ?? []) {
    if (!suggestion.accepted || !suggestion.keyword) continue;
    const normalized = normalizeKeyword(suggestion.keyword);
    const candidate = candidates.find((entry) => normalizeKeyword(entry.keyword) === normalized);
    if (!candidate) continue;
    const lane = isSourceLane(suggestion.lane) ? suggestion.lane : candidate.lane;
    if (!lane) continue;

    const upserted = await db.keywordSuggestion.upsert({
      where: { normalizedKeyword: normalized },
      create: {
        keyword: suggestion.keyword,
        normalizedKeyword: normalized,
        lane,
        confidence: Math.round((suggestion.confidence ?? KEYWORD_CONFIDENCE_FALLBACK) * 100) / 100,
        sourceCount: candidate.count,
        evidence: {
          reason: suggestion.reason ?? null,
          snippets: candidate.evidence,
        } as Prisma.InputJsonValue,
      },
      update: {
        keyword: suggestion.keyword,
        lane,
        confidence: Math.round((suggestion.confidence ?? KEYWORD_CONFIDENCE_FALLBACK) * 100) / 100,
        sourceCount: candidate.count,
        evidence: {
          reason: suggestion.reason ?? null,
          snippets: candidate.evidence,
        } as Prisma.InputJsonValue,
      },
    });

    if (upserted.createdAt.getTime() === upserted.updatedAt.getTime()) created++;
    else updated++;
  }

  return { created, updated, candidates: candidates.length };
}

export async function getApprovedDynamicKeywordsByLane(): Promise<ApprovedDynamicKeywordsByLane> {
  const rows = await db.keywordSuggestion.findMany({
    where: { status: KeywordSuggestionStatus.APPROVED },
    select: { keyword: true, lane: true },
    orderBy: { confidence: 'desc' },
  });

  const byLane: Record<SourceLane, string[]> = {
    EVENT: [],
    COMMUNITY: [],
    RESOURCE: [],
  };

  for (const row of rows) {
    if (!isSourceLane(row.lane)) continue;

    byLane[row.lane].push(row.keyword);
  }

  return {
    byLane: {
      EVENT: [...new Set(byLane.EVENT)],
      COMMUNITY: [...new Set(byLane.COMMUNITY)],
      RESOURCE: [...new Set(byLane.RESOURCE)],
    },
  };
}
