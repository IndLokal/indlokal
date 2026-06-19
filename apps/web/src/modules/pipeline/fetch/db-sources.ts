/**
 * DB-driven pinned source generation for the fetch layer.
 *
 * Instead of hardcoding community website URLs in runtime pipeline code, this
 * module queries active communities with scrapeable channels (WEBSITE, MEETUP)
 * and emits pinned-url strategies for planner execution.
 *
 * Benefits:
 *  - New communities added via admin/submit automatically become pipeline sources
 *  - No manual URL maintenance
 *  - Community city is known → hintCitySlug is always accurate
 *
 * Lane model:
 * - Outputs here are EVENT-lane candidates (homepages + event subpages)
 * - Planner remains responsible for trigger-based lane filtering and caps
 */

import { db } from '@/lib/db';
import type { SearchStrategy } from '../types';
import {
  EVENT_PAGE_MARKERS,
  STRONG_FRESH_MARKERS,
  STALE_EVENT_MARKERS,
  getYearSignalScore,
} from '../freshness';
import { PIPELINE_USER_AGENT } from './http';
import {
  getDbSourceDiscoveryTopK,
  getDbSourceProbeConcurrency,
  getDbSourceProbeTimeoutMs,
} from '../config/env-config';

// Fallback list used only when homepage anchor discovery finds nothing for a
// site (typically because the nav is rendered client-side). Each candidate is
// HEAD-probed before being emitted, so 404/405 responses never reach the
// fetcher and never show up in pipeline_runs.errors.
const WEBSITE_EVENT_PATH_FALLBACK_CANDIDATES = [
  'events',
  'event',
  'calendar',
  'activities',
  'upcoming-events',
  'programme',
  'program',
  'veranstaltungen',
  'termine',
] as const;

function getDetailPageScore(url: string, labelOrText = ''): number {
  const combined = `${url} ${labelOrText}`;
  const yearScore = getYearSignalScore(combined);
  if (yearScore <= 0) return 0;

  const path = (() => {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  })();

  const segments = path.split('/').filter(Boolean);
  const hasDescriptiveDetailSlug = segments.some(
    (segment) => segment.split('-').filter(Boolean).length >= 3,
  );
  const hasRegistrationSignal = /registration|register|anmeldung|ticket|rsvp/i.test(combined);

  return hasDescriptiveDetailSlug || hasRegistrationSignal ? 3 : 0;
}

/** Score whether a URL/text pair looks like a fresh, event-focused destination. */
export function scorePinnedEventUrl(url: string, labelOrText = ''): number {
  const urlScore = EVENT_PAGE_MARKERS.test(url) ? 2 : 0;
  const labelScore = EVENT_PAGE_MARKERS.test(labelOrText) ? 1 : 0;
  const strongPositiveScore = STRONG_FRESH_MARKERS.test(`${url} ${labelOrText}`) ? 2 : 0;
  const negativeScore = STALE_EVENT_MARKERS.test(`${url} ${labelOrText}`) ? -3 : 0;
  const yearScore = getYearSignalScore(`${url} ${labelOrText}`);
  const detailPageScore = getDetailPageScore(url, labelOrText);

  return urlScore + labelScore + strongPositiveScore + negativeScore + yearScore + detailPageScore;
}

/**
 * Remove HTML tags from a string using repeated replacement until stable.
 * This avoids incomplete multi-character sanitization edge cases where
 * dangerous fragments can reappear after a single pass.
 */
function stripHtmlTags(input: string): string {
  let current = input;
  let previous: string;
  do {
    previous = current;
    current = current.replace(/<[^>]+>/g, '');
  } while (current !== previous);
  return current;
}

function isMalformedDiscoveredHref(rawHref: string, resolved: URL): boolean {
  const decodedHref = rawHref.replace(/&quot;|&#34;|&#x22;/gi, '"');
  if (/["'<>]/.test(decodedHref)) return true;
  if (/%22|%27/i.test(resolved.href)) return true;
  if (/https?:/i.test(resolved.pathname)) return true;
  return false;
}

function isStableEventListingUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase().replace(/\/+$/, '');
    return /\/(events?|calendar|activities|programme|program|agenda|schedule|upcoming-events?|veranstaltungen|termine)$/.test(
      path,
    );
  } catch {
    return false;
  }
}

function buildFallbackCandidatePaths(websiteUrl: string): string[] {
  try {
    const parsed = new URL(websiteUrl);
    const basePath = parsed.pathname.replace(/\/+$/, '');
    const roots = new Set<string>();

    // Only expand from origin. Nested expansion (origin + /about-us/events) is
    // almost always wrong and is the historical source of 404 noise.
    roots.add(parsed.origin);
    if (basePath && basePath !== '/' && basePath.split('/').filter(Boolean).length === 1) {
      // One safe nested root: /<lang>/events where the channel URL is
      // language-prefixed (e.g. /de/, /en/). Anything deeper is dropped.
      const seg = basePath.replace(/^\//, '');
      if (/^[a-z]{2}(-[a-z]{2})?$/i.test(seg)) {
        roots.add(`${parsed.origin}${basePath}`);
      }
    }

    const candidates = new Set<string>();
    for (const root of roots) {
      for (const segment of WEBSITE_EVENT_PATH_FALLBACK_CANDIDATES) {
        const candidate = `${root}/${segment}`.replace(/([^:]\/)\/+/, '$1');
        candidates.add(candidate);
      }
    }

    return [...candidates].filter(isStableEventListingUrl);
  } catch {
    return [];
  }
}

/**
 * Cheap existence check: HEAD first; on 405 or other rejection of HEAD, try
 * a GET with a short timeout and only check the response status. Returns true
 * only for 2xx and final-redirected 2xx.
 */
async function probeUrlExists(url: string): Promise<boolean> {
  const probeTimeoutMs = getDbSourceProbeTimeoutMs();
  const headers = { 'User-Agent': PIPELINE_USER_AGENT };
  const signal = AbortSignal.timeout(probeTimeoutMs);
  try {
    const res = await fetch(url, { method: 'HEAD', headers, signal, redirect: 'follow' });
    if (res.ok) return true;
    if (res.status === 405 || res.status === 501) {
      // Server doesn't allow HEAD — verify with GET.
      const getRes = await fetch(url, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(probeTimeoutMs),
        redirect: 'follow',
      });
      // Abort body read; we only care about the status.
      try {
        await getRes.body?.cancel();
      } catch {
        // ignore
      }
      return getRes.ok;
    }
    return false;
  } catch {
    return false;
  }
}

async function probeCandidatesInParallel(urls: string[]): Promise<string[]> {
  const probeConcurrency = getDbSourceProbeConcurrency();
  const survivors: string[] = [];
  for (let i = 0; i < urls.length; i += probeConcurrency) {
    const batch = urls.slice(i, i + probeConcurrency);
    const results = await Promise.all(
      batch.map((u) => probeUrlExists(u).then((ok) => ({ u, ok }))),
    );
    for (const { u, ok } of results) if (ok) survivors.push(u);
  }
  return survivors;
}

/**
 * Fetch a community homepage and extract internal links that look like they
 * lead to an events or programme page.
 *
 * Strategy:
 *  - Parse all <a href> tags from the HTML
 *  - Keep only same-host links (not external)
 *  - Score each by whether the URL path and/or link text matches event keywords
 *  - Return the top K highest-scored URLs (configurable via env-config)
 *
 * Returns [] on any fetch/parse failure - caller must handle gracefully.
 */
async function discoverEventLinks(websiteUrl: string): Promise<string[]> {
  try {
    const res = await fetch(websiteUrl, {
      headers: { 'User-Agent': PIPELINE_USER_AGENT },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];

    const html = await res.text();
    const parsed = new URL(websiteUrl);

    // Match <a href="...">link text</a> - captures href and inner content
    const linkPattern =
      /<a\b[^>]*?\bhref=(?:"([^"#][^"]*?)"|'([^'#][^']*?)'|([^\s>"'#][^\s>]*))[^>]*>([\s\S]*?)<\/a>/gi;

    const scored = new Map<string, number>(); // canonical URL → best score

    for (const match of html.matchAll(linkPattern)) {
      const rawHref = match[1] ?? match[2] ?? match[3];
      const rawText = stripHtmlTags(match[4] ?? '').trim();
      if (!rawHref) continue;

      let resolved: URL;
      try {
        resolved = new URL(rawHref, websiteUrl);
      } catch {
        continue;
      }
      if (isMalformedDiscoveredHref(rawHref, resolved)) continue;

      // Internal links only; skip root and the current page
      if (resolved.hostname !== parsed.hostname) continue;
      if (resolved.pathname === '/' || resolved.pathname === parsed.pathname) continue;

      const score = scorePinnedEventUrl(resolved.pathname, rawText);
      if (score <= 0) continue;

      const key = resolved.origin + resolved.pathname; // ignore query/hash
      if ((scored.get(key) ?? 0) < score) scored.set(key, score);
    }

    return [...scored.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, getDbSourceDiscoveryTopK())
      .map(([url]) => url);
  } catch {
    return [];
  }
}

/**
 * Query the database for all active communities with scrapeable access channels,
 * and return a SearchStrategy[] of pinned_url entries.
 *
 * Each community website becomes a source the pipeline can fetch and extract from.
 */
export async function getDbCommunityStrategies(): Promise<
  (SearchStrategy & { kind: 'pinned_url' })[]
> {
  const communities = await db.community.findMany({
    where: {
      mergedIntoId: null,
      // Include UNVERIFIED: directory-seed entries have verified public URLs even
      // though the org's identity claim hasn't been confirmed yet. Excluding them
      // means none of our curated community websites are ever scraped.
      status: { in: ['ACTIVE', 'CLAIMED', 'UNVERIFIED'] },
    },
    include: {
      accessChannels: {
        where: {
          channelType: { in: ['WEBSITE', 'MEETUP'] },
        },
      },
      city: {
        select: { slug: true },
      },
    },
  });

  const strategies: (SearchStrategy & { kind: 'pinned_url' })[] = [];
  const strategyIds = new Set<string>();

  const pushStrategy = (strategy: SearchStrategy & { kind: 'pinned_url' }) => {
    if (strategyIds.has(strategy.id)) return;
    strategyIds.add(strategy.id);
    strategies.push(strategy);
  };

  // Phase 1: generate all strategies that don't require extra HTTP fetches
  // (Meetup events pages + Website homepages), and collect the Website channels
  // whose homepages we need to crawl for event-sub-page links.
  type WebsiteJob = { community: (typeof communities)[number]; url: string };
  const websiteJobs: WebsiteJob[] = [];

  for (const community of communities) {
    for (const channel of community.accessChannels) {
      if (!channel.url?.startsWith('http')) continue;

      const base = channel.url.replace(/\/$/, '');

      if (channel.channelType === 'MEETUP') {
        // Scrape /events/ - the group homepage has org info (→ COMMUNITY,
        // deduped); the events page has upcoming event listings (→ EVENTs).
        const eventsUrl = base.endsWith('/events') ? `${base}/` : `${base}/events/`;
        pushStrategy({
          id: `db-${community.slug}-meetup`,
          sourceType: 'DB_COMMUNITY',
          kind: 'pinned_url',
          label: `${community.name} (Meetup events)`,
          url: eventsUrl,
          hintCitySlug: community.city.slug,
          hintCommunityId: community.id,
          hintCommunityName: community.name,
          enabled: true,
          lane: 'EVENT',
        });
      } else {
        // Homepage: always include (useful for community discovery)
        pushStrategy({
          id: `db-${community.slug}-website`,
          sourceType: 'DB_COMMUNITY',
          kind: 'pinned_url',
          label: `${community.name} (website)`,
          url: channel.url,
          hintCitySlug: community.city.slug,
          hintCommunityId: community.id,
          hintCommunityName: community.name,
          enabled: true,
          lane: 'EVENT',
        });

        // Queue this channel for parallel event-link discovery below.
        // Heuristic path expansion (calendar/upcoming-events/programme/...)
        // is no longer emitted blindly — see Phase 2 for HEAD-probed fallback.
        websiteJobs.push({ community, url: channel.url });
      }
    }
  }

  // Phase 2: discover event sub-pages from all WEBSITE homepages in parallel.
  // Primary: parse <a href> anchors from the actual homepage HTML and keep the
  // top-scoring event-listing-like links. Only links that actually exist on
  // the page are emitted, eliminating 404 noise.
  //
  // Fallback (only when primary returns 0): HEAD-probe a short list of common
  // event paths (calendar, upcoming-events, programme, ...) and emit only the
  // ones that respond 2xx. This catches sites with client-rendered nav.
  const discoveryResults = await Promise.allSettled(
    websiteJobs.map(async ({ url }) => {
      const links = await discoverEventLinks(url);
      if (links.length > 0) return links;
      const candidates = buildFallbackCandidatePaths(url);
      if (candidates.length === 0) return [];
      return probeCandidatesInParallel(candidates);
    }),
  );

  for (let i = 0; i < websiteJobs.length; i++) {
    const job = websiteJobs[i];
    const outcome = discoveryResults[i];
    if (!job || outcome?.status !== 'fulfilled') continue;

    for (const eventUrl of outcome.value) {
      if (!isStableEventListingUrl(eventUrl)) continue;

      const pathKey = new URL(eventUrl).pathname
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 30);
      pushStrategy({
        id: `db-${job.community.slug}-website-${pathKey}`,
        sourceType: 'DB_COMMUNITY',
        kind: 'pinned_url',
        label: `${job.community.name} (${new URL(eventUrl).pathname})`,
        url: eventUrl,
        hintCitySlug: job.community.city.slug,
        hintCommunityId: job.community.id,
        hintCommunityName: job.community.name,
        enabled: true,
        lane: 'EVENT',
      });
    }
  }

  console.log(
    `[Pipeline] DB sources: ${strategies.length} scrapeable channels from ${communities.length} communities`,
  );
  return strategies;
}
