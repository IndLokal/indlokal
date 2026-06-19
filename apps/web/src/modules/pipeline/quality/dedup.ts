/**
 * Pipeline dedup primitives and thresholds.
 *
 * Centralizes comparison rules used by orchestrator queue-time checks and
 * review-time approval checks so both paths share the same behavior.
 *
 * Responsibilities:
 * - define dedup thresholds and status sets
 * - normalize URLs, titles, and identity signals
 * - provide similarity and identity-evidence predicates
 * - suppress re-queueing against recent rejected items
 */

import { db } from '@/lib/db';
import type { ExtractedData, ExtractedEvent } from '../types';
import {
  DEFAULT_EVENT_TIMEZONE,
  parseEventDateTimeInTimeZone,
} from '@/lib/datetime/event-timezone';

// ─────────────────────────────────────────────────────────────────────────────
// 1. Tuning constants — the ONLY place these numbers should be defined.
// ─────────────────────────────────────────────────────────────────────────────

/** Dice-coefficient title similarity above which two events are "similar". */
export const EVENT_TITLE_SIMILARITY_THRESHOLD = 0.7;

/**
 * If two normalized titles are an exact match and at least this long, treat
 * them as a canonical title match.
 */
export const EVENT_CANONICAL_TITLE_MIN_LENGTH = 8;

/** How far apart (in days) two events may start and still be duplicate candidates. */
export const EVENT_DATE_WINDOW_DAYS = 1;

/** Two starts within this many hours count as strong identity evidence. */
export const EVENT_IDENTITY_TIME_TOLERANCE_HOURS = 2;

/** Minimum normalized venue/host length before it can serve as identity evidence. */
export const EVENT_IDENTITY_MIN_TOKEN_LENGTH = 5;

/** Name similarity at/above which two communities are considered the same. */
export const COMMUNITY_DUPLICATE_NAME_THRESHOLD = 0.72;

/** Borderline name similarity that triggers a semantic (LLM) tie-break check. */
export const COMMUNITY_DUPLICATE_SEMANTIC_THRESHOLD = 0.35;

/** Exact-match name length above which two community names collapse to one. */
export const COMMUNITY_CANONICAL_NAME_MIN_LENGTH = 8;

/** Max recent queue/rejected rows to scan when comparing by normalized URL. */
export const DEDUP_QUEUE_SCAN_LIMIT = 300;

/** Pipeline statuses that represent an item that already "occupies a slot". */
export const DEDUP_ACTIVE_STATUSES = ['PENDING', 'APPROVED', 'MERGED'] as const;

/** Pipeline statuses an admin explicitly turned down. */
export const DEDUP_REJECTED_STATUSES = ['REJECTED'] as const;

// Tuning constants used by queue-time and approval-time dedup checks.

// ─────────────────────────────────────────────────────────────────────────────
// 2. Normalization helpers (pure, deterministic, unit-testable).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalize a SOURCE url (where we discovered the item) for comparison.
 * Keeps host + path and, for calendar feeds, the `#uid=` identity fragment so
 * two ICS entries from the same feed are distinguishable.
 */
export function normalizeSourceUrlForDedup(sourceUrl: string | null | undefined): string | null {
  if (!sourceUrl) return null;
  try {
    const url = new URL(sourceUrl);
    const pathname = decodeURIComponent(url.pathname).replace(/\/+$/, '') || '/';
    const eventIdentityFragment = url.hash.startsWith('#uid=')
      ? `#uid=${decodeURIComponent(url.hash.slice(5))}`
      : '';
    return `${url.hostname.toLowerCase()}${pathname}${eventIdentityFragment}`;
  } catch {
    return sourceUrl.toLowerCase().replace(/\/+$/, '');
  }
}

/**
 * Normalize a CONTENT url (e.g. registration link) to host + path. Unlike the
 * source-url variant, fragments and query strings are dropped because they
 * rarely change event identity.
 */
export function normalizeComparableUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const pathname = url.pathname.replace(/\/$/, '');
    return `${url.hostname.toLowerCase()}${pathname}`;
  } catch {
    return value.toLowerCase().replace(/\/$/, '');
  }
}

/**
 * Normalize an event title for dedup: strip years and city names (which vary
 * across postings of the same event) and collapse to lowercase alphanumerics.
 */
export function normalizeEventTitleForDedup(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(20\d{2})\b/g, ' ')
    .replace(/\b(berlin|stuttgart|frankfurt|karlsruhe|mannheim|munich|muenchen|münchen)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Normalize free-text identity signals (venue name, host community). Folds
 * German umlauts and removes legal/organizational suffixes so "Tamil Verein
 * e.V." and "Tamil Verein" compare equal.
 */
export function normalizeIdentityText(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/\b(e\.?\s?v\.?|verein|society|association|community|group|chapter)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Normalize a COMMUNITY name for dedup. Same intent as {@link normalizeIdentityText}
 * but kept as a dedicated name to make community call sites self-documenting.
 */
export function normalizeCommunityName(value: string | null | undefined): string {
  return normalizeIdentityText(value);
}

/**
 * Combine an event's date (YYYY-MM-DD) and optional time (HH:mm) into a Date,
 * interpreting the wall-clock value in `timeZone`. Used for relative date/time
 * comparisons during dedup; both sides of a comparison must use the same zone so
 * the comparison is consistent regardless of the server's local timezone.
 */
export function parseEventStart(
  date: string | null | undefined,
  time: string | null | undefined,
  timeZone: string = DEFAULT_EVENT_TIMEZONE,
): Date | null {
  return parseEventDateTimeInTimeZone(date, time, timeZone);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Similarity + identity-evidence predicates (pure).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sørensen–Dice coefficient over character bigrams. Returns 0..1 where 1 means
 * identical. Cheap, language-agnostic, and good enough for short titles/names.
 */
export function computeSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const bigramsA = new Set<string>();
  for (let i = 0; i < a.length - 1; i++) bigramsA.add(a.slice(i, i + 2));

  let intersection = 0;
  for (let i = 0; i < b.length - 1; i++) {
    if (bigramsA.has(b.slice(i, i + 2))) intersection++;
  }

  return (2 * intersection) / (a.length - 1 + (b.length - 1));
}

/** The minimal fields needed to reason about whether two events are the same. */
export type EventIdentityHints = {
  title?: string | null;
  date: string | null | undefined;
  time: string | null | undefined;
  venueName: string | null | undefined;
  hostCommunity: string | null | undefined;
};

/** True when two normalized strings overlap (equal or one contains the other). */
function tokensOverlap(a: string, b: string, minLength: number): boolean {
  return (
    a.length >= minLength && b.length >= minLength && (a === b || a.includes(b) || b.includes(a))
  );
}

/**
 * The CORE false-merge guard. Title similarity alone is NOT enough — a city can
 * legitimately run "Diwali Celebration" on three different dates. We only treat
 * two similar-titled events as the same if there is corroborating evidence:
 *   - the same venue, OR
 *   - the same host community, OR
 *   - start times within {@link EVENT_IDENTITY_TIME_TOLERANCE_HOURS} hours.
 */
export function hasStrongEventIdentityEvidence(
  incoming: EventIdentityHints,
  candidate: EventIdentityHints,
): boolean {
  if (
    tokensOverlap(
      normalizeIdentityText(incoming.venueName),
      normalizeIdentityText(candidate.venueName),
      EVENT_IDENTITY_MIN_TOKEN_LENGTH,
    )
  ) {
    return true;
  }

  if (
    tokensOverlap(
      normalizeIdentityText(incoming.hostCommunity),
      normalizeIdentityText(candidate.hostCommunity),
      EVENT_IDENTITY_MIN_TOKEN_LENGTH,
    )
  ) {
    return true;
  }

  const incomingStart = parseEventStart(incoming.date, incoming.time);
  const candidateStart = parseEventStart(candidate.date, candidate.time);
  if (incomingStart && candidateStart) {
    const hourDiff =
      Math.abs(incomingStart.getTime() - candidateStart.getTime()) / (1000 * 60 * 60);
    if (hourDiff <= EVENT_IDENTITY_TIME_TOLERANCE_HOURS) return true;
  }

  return false;
}

/**
 * Decide whether two event titles match for dedup purposes. Returns true when
 * the bigram similarity clears the threshold OR the normalized titles are an
 * exact canonical match (and long enough to be meaningful). This is the title
 * half of a duplicate decision — callers MUST still gate it with
 * {@link hasStrongEventIdentityEvidence}.
 */
export function isEventTitleMatch(incomingTitle: string, candidateTitle: string): boolean {
  const similarity = computeSimilarity(incomingTitle.toLowerCase(), candidateTitle.toLowerCase());
  if (similarity > EVENT_TITLE_SIMILARITY_THRESHOLD) return true;

  const a = normalizeEventTitleForDedup(incomingTitle);
  const b = normalizeEventTitleForDedup(candidateTitle);
  return a.length >= EVENT_CANONICAL_TITLE_MIN_LENGTH && a === b;
}

/**
 * Decide whether two community names match for dedup purposes: name similarity
 * clears the threshold, or the normalized names are an exact canonical match.
 */
export function isCommunityNameMatch(incomingName: string, candidateName: string): boolean {
  const a = normalizeCommunityName(incomingName);
  const b = normalizeCommunityName(candidateName);
  if (!a || !b) return false;
  const score = computeSimilarity(a, b);
  return (
    score >= COMMUNITY_DUPLICATE_NAME_THRESHOLD ||
    (a.length >= COMMUNITY_CANONICAL_NAME_MIN_LENGTH && a === b)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. DB-backed suppression of REJECTED items.
//
// PROBLEM THIS SOLVES: queue-time dedup only ever looked at PENDING/APPROVED/
// MERGED items. An item an admin REJECTED was invisible to the next run, so the
// same source would be re-extracted and re-queued day after day, wasting review
// effort. These helpers consult the rejection history and tell the orchestrator
// to drop the item instead of re-queuing it.
//
// We keep this STRICTER than normal dedup: rejection is a strong human signal,
// but we still require either an exact source-url match or a full title+identity
// match (events) / name match (communities) so a genuinely different item is not
// suppressed by an unrelated past rejection.
// ─────────────────────────────────────────────────────────────────────────────

/** Outcome of a rejection-history lookup. */
export type RejectedMatch = {
  matchedItemId: string;
  reason: 'rejected-source-url' | 'rejected-title-date' | 'rejected-name';
};

/**
 * Return a match if this event was previously rejected for the same city.
 * Compares by normalized source URL first (cheapest, strongest), then by
 * title + strong identity evidence within the date window.
 */
export async function findRejectedEventMatch(input: {
  event: ExtractedEvent;
  cityId: string;
  sourceUrl?: string | null;
}): Promise<RejectedMatch | null> {
  const { event, cityId, sourceUrl } = input;

  const rejectedItems = await db.pipelineItem.findMany({
    where: {
      cityId,
      entityType: 'EVENT',
      status: { in: [...DEDUP_REJECTED_STATUSES] },
    },
    orderBy: { reviewedAt: 'desc' },
    take: DEDUP_QUEUE_SCAN_LIMIT,
    select: { id: true, sourceUrl: true, extractedData: true },
  });
  if (rejectedItems.length === 0) return null;

  const normalizedIncomingSourceUrl = normalizeSourceUrlForDedup(sourceUrl);
  const incomingStart = parseEventStart(event.date, event.time);

  for (const item of rejectedItems) {
    // Strongest signal: the exact same source was already turned down.
    if (
      normalizedIncomingSourceUrl &&
      normalizeSourceUrlForDedup(item.sourceUrl) === normalizedIncomingSourceUrl
    ) {
      return { matchedItemId: item.id, reason: 'rejected-source-url' };
    }

    const previous = item.extractedData as unknown as Partial<ExtractedEvent>;
    if (!previous.title || !previous.date) continue;

    // Stay inside the date window before doing the expensive title comparison.
    const previousStart = parseEventStart(previous.date, previous.time ?? null);
    if (incomingStart && previousStart) {
      const dayDiff =
        Math.abs(incomingStart.getTime() - previousStart.getTime()) / (1000 * 60 * 60 * 24);
      if (dayDiff > EVENT_DATE_WINDOW_DAYS) continue;
    }

    if (
      isEventTitleMatch(event.title, previous.title) &&
      hasStrongEventIdentityEvidence(
        {
          date: event.date,
          time: event.time,
          venueName: event.venueName,
          hostCommunity: event.hostCommunity,
        },
        {
          date: previous.date,
          time: previous.time ?? null,
          venueName: previous.venueName ?? null,
          hostCommunity: previous.hostCommunity ?? null,
        },
      )
    ) {
      return { matchedItemId: item.id, reason: 'rejected-title-date' };
    }
  }

  return null;
}

/**
 * Return a match if this community was previously rejected for the same city.
 * Compares by normalized source URL first, then by normalized name match.
 */
export async function findRejectedCommunityMatch(input: {
  community: ExtractedData & { type: 'COMMUNITY' };
  cityId: string;
  sourceUrl?: string | null;
}): Promise<RejectedMatch | null> {
  const { community, cityId, sourceUrl } = input;

  const rejectedItems = await db.pipelineItem.findMany({
    where: {
      cityId,
      entityType: 'COMMUNITY',
      status: { in: [...DEDUP_REJECTED_STATUSES] },
    },
    orderBy: { reviewedAt: 'desc' },
    take: DEDUP_QUEUE_SCAN_LIMIT,
    select: { id: true, sourceUrl: true, extractedData: true },
  });
  if (rejectedItems.length === 0) return null;

  const normalizedIncomingSourceUrl = normalizeSourceUrlForDedup(sourceUrl);

  for (const item of rejectedItems) {
    if (
      normalizedIncomingSourceUrl &&
      normalizeSourceUrlForDedup(item.sourceUrl) === normalizedIncomingSourceUrl
    ) {
      return { matchedItemId: item.id, reason: 'rejected-source-url' };
    }

    const previous = item.extractedData as unknown as Partial<ExtractedData>;
    if (previous.type !== 'COMMUNITY' || !previous.name) continue;

    if (isCommunityNameMatch(community.name, String(previous.name))) {
      return { matchedItemId: item.id, reason: 'rejected-name' };
    }
  }

  return null;
}

/**
 * Return a match if this resource was previously rejected for the same city.
 * Compares by normalized source URL first, then by canonical URL/title similarity.
 */
export async function findRejectedResourceMatch(input: {
  resource: ExtractedData & { type: 'RESOURCE' };
  cityId: string;
  sourceUrl?: string | null;
}): Promise<RejectedMatch | null> {
  const { resource, cityId, sourceUrl } = input;

  const rejectedItems = await db.pipelineItem.findMany({
    where: {
      cityId,
      entityType: 'RESOURCE',
      status: { in: [...DEDUP_REJECTED_STATUSES] },
    },
    orderBy: { reviewedAt: 'desc' },
    take: DEDUP_QUEUE_SCAN_LIMIT,
    select: { id: true, sourceUrl: true, extractedData: true },
  });
  if (rejectedItems.length === 0) return null;

  const normalizedIncomingSourceUrl = normalizeSourceUrlForDedup(sourceUrl);
  const normalizedIncomingResourceUrl = normalizeComparableUrl(resource.url);
  const normalizedIncomingTitle = normalizeCommunityName(resource.title);

  for (const item of rejectedItems) {
    if (
      normalizedIncomingSourceUrl &&
      normalizeSourceUrlForDedup(item.sourceUrl) === normalizedIncomingSourceUrl
    ) {
      return { matchedItemId: item.id, reason: 'rejected-source-url' };
    }

    const previous = item.extractedData as unknown as Partial<ExtractedData>;
    if (previous.type !== 'RESOURCE' || !previous.title) continue;

    const previousUrl = normalizeComparableUrl(previous.url ?? null);
    if (
      normalizedIncomingResourceUrl &&
      previousUrl &&
      normalizedIncomingResourceUrl === previousUrl
    ) {
      return { matchedItemId: item.id, reason: 'rejected-source-url' };
    }

    const titleScore = computeSimilarity(
      normalizedIncomingTitle,
      normalizeCommunityName(previous.title),
    );
    if (titleScore >= COMMUNITY_DUPLICATE_NAME_THRESHOLD) {
      return { matchedItemId: item.id, reason: 'rejected-name' };
    }
  }

  return null;
}
