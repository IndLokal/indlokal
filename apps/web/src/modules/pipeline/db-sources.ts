/**
 * DB-driven source generation - reads community access channels from the
 * database and generates pinned_url strategies automatically.
 *
 * Instead of hardcoding community website URLs in runtime pipeline code, this module
 * queries all active communities that have scrapeable channels (WEBSITE, MEETUP)
 * and turns each into a SearchStrategy the orchestrator can fetch.
 *
 * Benefits:
 *  - New communities added via admin/submit automatically become pipeline sources
 *  - No manual URL maintenance
 *  - Community city is known → hintCitySlug is always accurate
 */

import { db } from '@/lib/db';
import type { SearchStrategy } from './types';
import {
  EVENT_PAGE_MARKERS,
  STRONG_FRESH_MARKERS,
  STALE_EVENT_MARKERS,
  getYearSignalScore,
} from './freshness';
import { PIPELINE_USER_AGENT } from './http';

const WEBSITE_EVENT_PATH_CANDIDATES = [
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

function buildWebsiteEventPathCandidates(websiteUrl: string): string[] {
  try {
    const parsed = new URL(websiteUrl);
    const basePath = parsed.pathname.replace(/\/+$/, '');
    const roots = new Set<string>();

    roots.add(parsed.origin);
    if (basePath && basePath !== '/') {
      roots.add(`${parsed.origin}${basePath}`);
    }

    const candidates = new Set<string>();
    for (const root of roots) {
      for (const segment of WEBSITE_EVENT_PATH_CANDIDATES) {
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
 * Fetch a community homepage and extract internal links that look like they
 * lead to an events or programme page.
 *
 * Strategy:
 *  - Parse all <a href> tags from the HTML
 *  - Keep only same-host links (not external)
 *  - Score each by whether the URL path and/or link text matches event keywords
 *  - Return the top 5 highest-scored URLs
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
      .slice(0, 5)
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
          enabled: true,
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
          enabled: true,
        });

        // Heuristic event paths: many community sites expose upcoming events on
        // predictable endpoints even when homepage links are JS-driven.
        const eventPathUrls = buildWebsiteEventPathCandidates(channel.url);
        for (const eventUrl of eventPathUrls) {
          const pathKey = new URL(eventUrl).pathname
            .replace(/[^a-z0-9]+/gi, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 30);
          pushStrategy({
            id: `db-${community.slug}-website-${pathKey}`,
            sourceType: 'DB_COMMUNITY',
            kind: 'pinned_url',
            label: `${community.name} (${new URL(eventUrl).pathname})`,
            url: eventUrl,
            hintCitySlug: community.city.slug,
            enabled: true,
          });
        }

        // Queue this channel for parallel event-link discovery below
        websiteJobs.push({ community, url: channel.url });
      }
    }
  }

  // Phase 2: discover event sub-pages from all WEBSITE homepages in parallel.
  // Running these concurrently instead of sequentially avoids adding 10-30s
  // of serial HTTP latency before the pipeline main fetch phase starts.
  const discoveryResults = await Promise.allSettled(
    websiteJobs.map(({ url }) => discoverEventLinks(url)),
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
        enabled: true,
      });
    }
  }

  console.log(
    `[Pipeline] DB sources: ${strategies.length} scrapeable channels from ${communities.length} communities`,
  );
  return strategies;
}
