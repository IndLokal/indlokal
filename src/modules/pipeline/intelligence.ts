import { db } from '@/lib/db';
import { CATEGORIES } from '@/lib/config';
import { Prisma, type RelationshipType } from '@prisma/client';
import { DIASPORA_KEYWORDS } from './config';
import { callOpenAI } from './extraction';
import type { ExtractedCommunity } from './types';

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

const KEYWORD_EVAL_PROMPT = `You evaluate keyword candidates for LocalPulse, a platform for Indian/South Asian diaspora discovery.

Return JSON:
{"suggestions": [{"keyword": "Tamil New Year", "accepted": true, "confidence": 0.9, "reason": "high-signal festival/community term"}]}

Accept terms that are strong diaspora search intents: regional communities, festivals, organization forms, diaspora events, consular services, or high-signal cultural phrases.
Reject generic words, cities, person names, and low-signal noise.`;

function normalizeKeyword(keyword: string): string {
  return keyword.trim().toLowerCase().replace(/\s+/g, ' ');
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

    if (!best || (best.confidence ?? 0) < 0.8) return null;

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
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchSourceText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'LocalPulseBot/1.0 (+https://localpulse.de)' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return null;
    const text = await response.text();
    const cleaned = stripHtml(text);
    return cleaned.slice(0, 12_000);
  } catch {
    return null;
  }
}

export async function enrichSparseCommunities(limit = 10) {
  const communities = await db.community.findMany({
    where: {
      status: { in: ['ACTIVE', 'CLAIMED', 'UNVERIFIED'] },
      mergedIntoId: null,
      completenessScore: { lt: 40 },
      OR: [
        { lastEnrichedAt: null },
        { lastEnrichedAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      ],
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
        reviewKind: 'ENRICHMENT',
        status: 'PENDING',
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
          entityType: 'COMMUNITY',
          reviewKind: 'ENRICHMENT',
          sourceType: 'DB_COMMUNITY',
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
  return name
    .toLowerCase()
    .replace(new RegExp(`\\b(${cityPattern})\\b`, 'g'), ' ')
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
    where: { mergedIntoId: null, status: { not: 'INACTIVE' } },
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
        await upsertEdge(source.id, target.id, 'SAME_ORGANIZER', 0.95, {
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

      await upsertEdge(source.id, target.id, 'SISTER_CHAPTER', 0.75, {
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
  items: Array<{ text: string }>,
): Array<{ keyword: string; count: number; evidence: string[] }> {
  const stopwords = new Set([
    'india',
    'indian',
    'germany',
    'german',
    'stuttgart',
    'munich',
    'frankfurt',
    'karlsruhe',
    'mannheim',
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
    '2026',
  ]);
  const counts = new Map<string, { count: number; evidence: string[] }>();

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
        if (normalized.length < 4 || normalized.length > 32) continue;
        if (DIASPORA_KEYWORDS.map(normalizeKeyword).includes(normalized)) continue;
        if (stopwords.has(normalized)) continue;
        if (/^\d+$/.test(normalized)) continue;

        const entry = counts.get(normalized) ?? { count: 0, evidence: [] };
        entry.count += 1;
        if (entry.evidence.length < 3) entry.evidence.push(item.text.slice(0, 120));
        counts.set(normalized, entry);
      }
    }
  }

  return [...counts.entries()]
    .filter(([, entry]) => entry.count >= 2)
    .map(([keyword, entry]) => ({ keyword, count: entry.count, evidence: entry.evidence }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);
}

export async function refreshKeywordSuggestions() {
  const approvedItems = await db.pipelineItem.findMany({
    where: { status: 'APPROVED' },
    select: { extractedData: true },
    take: 200,
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
      return { text };
    })
    .filter((item) => item.text.trim().length > 0);

  const candidates = extractCandidateKeywords(texts);
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

    const upserted = await db.keywordSuggestion.upsert({
      where: { normalizedKeyword: normalized },
      create: {
        keyword: suggestion.keyword,
        normalizedKeyword: normalized,
        confidence: Math.round((suggestion.confidence ?? 0.6) * 100) / 100,
        sourceCount: candidate.count,
        evidence: {
          reason: suggestion.reason ?? null,
          snippets: candidate.evidence,
        } as Prisma.InputJsonValue,
      },
      update: {
        keyword: suggestion.keyword,
        confidence: Math.round((suggestion.confidence ?? 0.6) * 100) / 100,
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

export async function getApprovedDynamicKeywords(): Promise<string[]> {
  const rows = await db.keywordSuggestion.findMany({
    where: { status: 'APPROVED' },
    select: { keyword: true },
    orderBy: { confidence: 'desc' },
  });
  return rows.map((row) => row.keyword);
}
