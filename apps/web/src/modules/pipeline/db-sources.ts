/**
 * DB-driven source generation — reads community access channels from the
 * database and generates pinned_url strategies automatically.
 *
 * Instead of hardcoding community website URLs in config.ts, this module
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

const EVENT_LINK_KEYWORDS =
  /event|veranstaltung|programm|kalender|calendar|activit|agenda|upcoming|termin|what.?s.?on|schedule/i;
const EVENT_LINK_STRONG_POSITIVE_KEYWORDS =
  /upcoming|next|calendar|kalender|schedule|termin|what.?s.?on|programme|programm/i;
const EVENT_LINK_NEGATIVE_KEYWORDS =
  /past|archive|archiv|gallery|eventgallery|album|photo|foto|bericht|review|recap/i;

function getYearSignalScore(input: string): number {
  const currentYear = new Date().getFullYear();
  const years = [...input.matchAll(/\b20\d{2}\b/g)]
    .map((match) => Number.parseInt(match[0], 10))
    .filter(Number.isFinite);

  if (years.length === 0) return 0;

  const newestYear = Math.max(...years);
  if (newestYear < currentYear) return -2;
  if (newestYear === currentYear) return 1;
  return 2;
}

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
  const urlScore = EVENT_LINK_KEYWORDS.test(url) ? 2 : 0;
  const labelScore = EVENT_LINK_KEYWORDS.test(labelOrText) ? 1 : 0;
  const strongPositiveScore = EVENT_LINK_STRONG_POSITIVE_KEYWORDS.test(`${url} ${labelOrText}`)
    ? 2
    : 0;
  const negativeScore = EVENT_LINK_NEGATIVE_KEYWORDS.test(`${url} ${labelOrText}`) ? -3 : 0;
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
 * Returns [] on any fetch/parse failure — caller must handle gracefully.
 */
async function discoverEventLinks(websiteUrl: string): Promise<string[]> {
  try {
    const res = await fetch(websiteUrl, {
      headers: { 'User-Agent': 'IndLokal-ContentBot/1.0 (+https://indlokal.de)' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];

    const html = await res.text();
    const parsed = new URL(websiteUrl);

    // Match <a href="...">link text</a> — captures href and inner content
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
        // Scrape /events/ — the group homepage has org info (→ COMMUNITY,
        // deduped); the events page has upcoming event listings (→ EVENTs).
        const eventsUrl = base.endsWith('/events') ? `${base}/` : `${base}/events/`;
        strategies.push({
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
        strategies.push({
          id: `db-${community.slug}-website`,
          sourceType: 'DB_COMMUNITY',
          kind: 'pinned_url',
          label: `${community.name} (website)`,
          url: channel.url,
          hintCitySlug: community.city.slug,
          enabled: true,
        });
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
      const pathKey = new URL(eventUrl).pathname
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 30);
      strategies.push({
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
