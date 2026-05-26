/**
 * Source adapters — fetch raw content from external sources.
 *
 * Two modes:
 *  1. Keyword search (Eventbrite) — takes a region + keywords, returns items from anywhere in that region
 *  2. Pinned URL (Facebook, websites) — fetches a specific known URL
 *
 * Adapters never assign a city. That's the LLM's job.
 */

import type { FetchResult, RawContent, SearchRegion, SearchStrategy } from './types';
import { collapseWhitespace, decodeHtmlEntities, htmlToText } from './text';
import { PIPELINE_USER_AGENT } from './http';
import { fetchEmbeddedGoogleCalendarEvents } from './calendar';

function parseHttpUrl(rawUrl: string): URL | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed;
  } catch {
    return null;
  }
}

function isBlockedSearchHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === 'duckduckgo.com' ||
    normalized.endsWith('.duckduckgo.com') ||
    normalized === 'facebook.com' ||
    normalized.endsWith('.facebook.com') ||
    normalized === 'instagram.com' ||
    normalized.endsWith('.instagram.com')
  );
}

function extractImageUrls(html: string, baseUrl: string): string[] {
  const imagePattern = /<img\b[^>]*\bsrc=(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi;
  const urls: string[] = [];

  for (const match of html.matchAll(imagePattern)) {
    const rawSource = match[1] ?? match[2] ?? match[3];
    if (!rawSource) continue;
    let resolvedUrl: string;
    try {
      resolvedUrl = new URL(rawSource, baseUrl).toString();
    } catch {
      continue;
    }
    const parsed = parseHttpUrl(resolvedUrl);
    if (!parsed) continue;
    urls.push(parsed.toString());
  }

  return urls;
}

function stripHtmlTagBlocks(input: string, tags: readonly string[]): string {
  let output = input;

  for (const tagName of tags) {
    const openToken = `<${tagName.toLowerCase()}`;
    const closeToken = `</${tagName.toLowerCase()}`;
    const lower = output.toLowerCase();
    let cursor = 0;
    let cleaned = '';

    while (cursor < output.length) {
      const openIndex = lower.indexOf(openToken, cursor);
      if (openIndex === -1) {
        cleaned += output.slice(cursor);
        break;
      }

      cleaned += output.slice(cursor, openIndex);

      const openEnd = lower.indexOf('>', openIndex + openToken.length);
      if (openEnd === -1) {
        cursor = output.length;
        break;
      }

      const closeIndex = lower.indexOf(closeToken, openEnd + 1);
      if (closeIndex === -1) {
        cursor = output.length;
        break;
      }

      const closeEnd = lower.indexOf('>', closeIndex + closeToken.length);
      if (closeEnd === -1) {
        cursor = output.length;
        break;
      }

      cursor = closeEnd + 1;
    }

    output = cleaned;
  }

  return output;
}

function getExpansionLimit(): number {
  const parsed = Number.parseInt(process.env.PIPELINE_PINNED_EXPANSION_LIMIT ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 6;
}

function getSecondHopExpansionLimit(): number {
  const parsed = Number.parseInt(process.env.PIPELINE_PINNED_SECOND_HOP_LIMIT ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 8;
}

function supportsSecondHopExpansion(strategy: SearchStrategy & { kind: 'pinned_url' }): boolean {
  return process.env.PIPELINE_PINNED_SECOND_HOP === '1' && shouldExpandPinnedUrl(strategy);
}

function getExpansionSourceTypes(): Set<string> {
  const raw = process.env.PIPELINE_PINNED_EXPANSION_SOURCE_TYPES ?? '';
  return new Set(
    raw
      .split(',')
      .map((entry) => entry.trim().toUpperCase())
      .filter(Boolean),
  );
}

function shouldExpandPinnedUrl(strategy: SearchStrategy & { kind: 'pinned_url' }): boolean {
  if (process.env.PIPELINE_PINNED_LINK_EXPANSION !== '1') return false;
  const allowedSourceTypes = getExpansionSourceTypes();
  if (allowedSourceTypes.size === 0) return false;
  return (
    allowedSourceTypes.has('*') || allowedSourceTypes.has(String(strategy.sourceType).toUpperCase())
  );
}

function shouldSkipExpansionPath(pathname: string): boolean {
  return /impressum|privacy|datenschutz|terms|cookie|kontakt|contact|login|signup|register|account|shop|cart/i.test(
    pathname,
  );
}

function extractPinnedExpansionLinks(html: string, baseUrl: string): string[] {
  const base = parseHttpUrl(baseUrl);
  if (!base) return [];
  const allowCrossHost = process.env.PIPELINE_PINNED_EXPANSION_ALLOW_CROSS_HOST === '1';

  const linkPattern =
    /<a\b[^>]*?\bhref=(?:"([^"#][^"]*?)"|'([^'#][^']*?)'|([^\s>"'#][^\s>]*))[^>]*>([\s\S]*?)<\/a>/gi;

  const unique = new Set<string>();
  for (const match of html.matchAll(linkPattern)) {
    const rawHref = match[1] ?? match[2] ?? match[3];
    if (!rawHref) continue;

    let resolved: URL;
    try {
      resolved = new URL(rawHref, baseUrl);
    } catch {
      continue;
    }

    const parsed = parseHttpUrl(resolved.toString());
    if (!parsed) continue;
    if (isBlockedSearchHost(parsed.hostname)) continue;
    if (!allowCrossHost && parsed.hostname !== base.hostname) continue;
    if (shouldSkipExpansionPath(parsed.pathname.toLowerCase())) continue;

    const canonical = `${parsed.origin}${parsed.pathname}`;
    if (canonical === `${base.origin}${base.pathname}`) continue;
    unique.add(canonical);
  }

  return [...unique].slice(0, getExpansionLimit());
}

async function fetchExpandedPinnedPage(sourceType: RawContent['sourceType'], url: string) {
  const res = await fetch(url, {
    headers: { 'User-Agent': PIPELINE_USER_AGENT },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;

  const rawHtml = await res.text();
  const html = stripHtmlTagBlocks(rawHtml, ['script', 'style']);
  const imageUrls = extractImageUrls(html, url).slice(0, 5);
  const text = collapseWhitespace(decodeHtmlEntities(htmlToText(html))).slice(0, 15_000);

  return {
    item: {
      sourceType,
      sourceUrl: url,
      text,
      imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
      fetchedAt: new Date().toISOString(),
    } satisfies RawContent,
    html: rawHtml,
  };
}

// ─── Keyword search: Eventbrite ────────────────────────

export async function fetchEventbriteKeywords(
  strategy: SearchStrategy & { kind: 'keyword_search' },
  region: SearchRegion,
): Promise<FetchResult> {
  const apiKey = process.env.EVENTBRITE_API_KEY;
  const items: RawContent[] = [];
  const errors: string[] = [];

  if (!apiKey) {
    return {
      sourceId: `${strategy.id}:${region.id}`,
      items,
      errors: ['EVENTBRITE_API_KEY not configured'],
    };
  }

  for (const keyword of strategy.keywords) {
    try {
      const url = new URL('https://www.eventbriteapi.com/v3/events/search/');
      url.searchParams.set('q', keyword);
      url.searchParams.set('location.address', region.searchCenter);
      url.searchParams.set('location.within', `${strategy.radiusKm}km`);
      url.searchParams.set('expand', 'venue');
      url.searchParams.set('sort_by', 'date');
      // Only return future events — no point queuing things that have already happened
      url.searchParams.set('start_date.range_start', new Date().toISOString());

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        errors.push(`Eventbrite "${keyword}" in ${region.id}: HTTP ${res.status}`);
        continue;
      }

      const data = (await res.json()) as {
        events?: Array<{
          id: string;
          name?: { text?: string };
          description?: { text?: string };
          url?: string;
          start?: { local?: string };
          end?: { local?: string };
          venue?: { name?: string; address?: { localized_address_display?: string } };
          logo?: { url?: string };
          is_free?: boolean;
        }>;
      };

      for (const ev of data.events ?? []) {
        items.push({
          sourceType: 'EVENTBRITE',
          sourceUrl: ev.url ?? `https://eventbrite.com/e/${ev.id}`,
          text: [
            ev.name?.text ?? '',
            ev.description?.text ?? '',
            ev.venue?.name ?? '',
            ev.venue?.address?.localized_address_display ?? '',
            ev.start?.local ?? '',
            ev.end?.local ?? '',
            ev.is_free ? 'Free' : 'Paid',
            ev.url ?? '',
          ].join('\n'),
          imageUrls: ev.logo?.url ? [ev.logo.url] : undefined,
          fetchedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      errors.push(`Eventbrite "${keyword}" in ${region.id}: ${String(err)}`);
    }
  }

  // Deduplicate by sourceUrl
  const seen = new Set<string>();
  const unique = items.filter((item) => {
    if (seen.has(item.sourceUrl)) return false;
    seen.add(item.sourceUrl);
    return true;
  });

  return { sourceId: `${strategy.id}:${region.id}`, items: unique, errors };
}

// ─── Pinned URL: generic website / scrape ──────────────

export async function fetchPinnedUrl(
  strategy: SearchStrategy & { kind: 'pinned_url' },
): Promise<FetchResult> {
  const items: RawContent[] = [];
  const errors: string[] = [];
  const discoveredUrls = new Set<string>([strategy.url]);

  try {
    const isFacebook = strategy.sourceType === 'FACEBOOK';
    const fetchUrl = isFacebook
      ? strategy.url.replace('www.facebook.com', 'm.facebook.com')
      : strategy.url;

    const res = await fetch(fetchUrl, {
      headers: {
        'User-Agent': isFacebook
          ? 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36'
          : PIPELINE_USER_AGENT,
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      return { sourceId: strategy.id, items, errors: [`HTTP ${res.status} from ${strategy.url}`] };
    }

    const rawHtml = await res.text();

    // Strip script/style blocks before text extraction. Their contents are
    // mostly noise for extraction and can drown useful page signals.
    const html = stripHtmlTagBlocks(rawHtml, ['script', 'style']);

    const imageUrls = extractImageUrls(html, strategy.url).slice(0, 5);
    const text = collapseWhitespace(decodeHtmlEntities(htmlToText(html))).slice(0, 15_000);

    items.push({
      sourceType: strategy.sourceType,
      sourceUrl: strategy.url,
      text,
      imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
      fetchedAt: new Date().toISOString(),
    });

    const calendarFeedResult = await fetchEmbeddedGoogleCalendarEvents(
      strategy.sourceType,
      rawHtml,
    );
    if (calendarFeedResult.items.length > 0) {
      items.push(...calendarFeedResult.items);
    }
    if (calendarFeedResult.errors.length > 0) {
      errors.push(...calendarFeedResult.errors);
    }

    if (shouldExpandPinnedUrl(strategy)) {
      const links = extractPinnedExpansionLinks(rawHtml, strategy.url);
      if (links.length > 0) {
        for (const link of links) discoveredUrls.add(link);
        const expanded = await Promise.allSettled(
          links.map((url) => fetchExpandedPinnedPage(strategy.sourceType, url)),
        );

        const secondHopCandidates: string[] = [];

        for (const outcome of expanded) {
          if (outcome.status === 'fulfilled' && outcome.value) {
            items.push(outcome.value.item);
            if (supportsSecondHopExpansion(strategy)) {
              const linksFromExpanded = extractPinnedExpansionLinks(
                outcome.value.html,
                outcome.value.item.sourceUrl,
              );
              for (const link of linksFromExpanded) {
                if (!discoveredUrls.has(link)) {
                  discoveredUrls.add(link);
                  secondHopCandidates.push(link);
                }
              }
            }
          } else if (outcome.status === 'rejected') {
            errors.push(`Expanded fetch ${strategy.url}: ${String(outcome.reason)}`);
          }
        }

        if (supportsSecondHopExpansion(strategy) && secondHopCandidates.length > 0) {
          const secondHopLinks = secondHopCandidates.slice(0, getSecondHopExpansionLimit());
          const secondHop = await Promise.allSettled(
            secondHopLinks.map((url) => fetchExpandedPinnedPage(strategy.sourceType, url)),
          );

          for (const outcome of secondHop) {
            if (outcome.status === 'fulfilled' && outcome.value) {
              items.push(outcome.value.item);
            } else if (outcome.status === 'rejected') {
              errors.push(`Second-hop fetch ${strategy.url}: ${String(outcome.reason)}`);
            }
          }
        }
      }
    }
  } catch (err) {
    errors.push(`Fetch ${strategy.url}: ${String(err)}`);
  }

  const seen = new Set<string>();
  const unique = items.filter((item) => {
    if (seen.has(item.sourceUrl)) return false;
    seen.add(item.sourceUrl);
    return true;
  });

  return { sourceId: strategy.id, items: unique, errors };
}

// ─── Google Custom Search: discover scattered mentions ──

/**
 * Search Google Custom Search API for diaspora community mentions.
 * Finds groups that only exist as mentions on blogs, university pages,
 * directories, or community boards — no dedicated website needed.
 *
 * Requires: GOOGLE_CSE_API_KEY + GOOGLE_CSE_ID environment variables.
 * Free tier: 100 queries/day. Each keyword search = 1 query.
 */
export async function fetchGoogleSearch(
  strategy: SearchStrategy & { kind: 'keyword_search' },
  region: SearchRegion,
): Promise<FetchResult> {
  const apiKey = process.env.GOOGLE_CSE_API_KEY;
  const cseId = process.env.GOOGLE_CSE_ID;
  const items: RawContent[] = [];
  const errors: string[] = [];

  if (!apiKey || !cseId) {
    return {
      sourceId: `${strategy.id}:${region.id}`,
      items,
      errors: ['GOOGLE_CSE_API_KEY or GOOGLE_CSE_ID not configured'],
    };
  }

  for (const keyword of strategy.keywords) {
    try {
      // Combine keyword with region for location-scoped search
      const query = `${keyword} ${region.searchCenter}`;
      const url = new URL('https://www.googleapis.com/customsearch/v1');
      url.searchParams.set('key', apiKey);
      url.searchParams.set('cx', cseId);
      url.searchParams.set('q', query);
      url.searchParams.set('num', '10');

      const res = await fetch(url.toString(), {
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        errors.push(`Google CSE "${keyword}" in ${region.id}: HTTP ${res.status}`);
        continue;
      }

      const data = (await res.json()) as {
        items?: Array<{
          title?: string;
          link?: string;
          snippet?: string;
          pagemap?: {
            metatags?: Array<{ 'og:description'?: string }>;
          };
        }>;
      };

      for (const result of data.items ?? []) {
        if (!result.link) continue;
        const description = result.pagemap?.metatags?.[0]?.['og:description'] ?? '';
        items.push({
          sourceType: 'GOOGLE_SEARCH',
          sourceUrl: result.link,
          text: [result.title ?? '', result.snippet ?? '', description, result.link].join('\n'),
          fetchedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      errors.push(`Google CSE "${keyword}" in ${region.id}: ${String(err)}`);
    }
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  const unique = items.filter((item) => {
    if (seen.has(item.sourceUrl)) return false;
    seen.add(item.sourceUrl);
    return true;
  });

  return { sourceId: `${strategy.id}:${region.id}`, items: unique, errors };
}

// ─── DuckDuckGo HTML Search: free web search ───────────

/**
 * Search DuckDuckGo HTML endpoint for diaspora community mentions.
 * Free, no API key needed. Parses the HTML lite search results page.
 *
 * Limitations:
 *  - Rate-limited by DDG (add delays between queries)
 *  - HTML structure may change (fragile scraping)
 *  - Returns ~10 results per query
 */
export async function fetchDuckDuckGoSearch(
  strategy: SearchStrategy & { kind: 'keyword_search' },
  region: SearchRegion,
): Promise<FetchResult> {
  const items: RawContent[] = [];
  const errors: string[] = [];

  for (const [index, keyword] of strategy.keywords.entries()) {
    try {
      console.log(
        `[Pipeline] DDG ${region.id}: keyword ${index + 1}/${strategy.keywords.length} (${keyword})`,
      );
      const query = `${keyword} ${region.searchCenter}`;
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

      const res = await fetch(url, {
        headers: {
          'User-Agent': PIPELINE_USER_AGENT,
        },
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        errors.push(`DuckDuckGo "${keyword}" in ${region.id}: HTTP ${res.status}`);
        continue;
      }

      const html = await res.text();

      // Parse DDG HTML results: extract uddg-encoded URLs and their surrounding text
      // DDG result links contain uddg= parameter with percent-encoded real URL
      const resultPattern = /href="[^"]*[?&]uddg=([^&"]+)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
      const matches = [...html.matchAll(resultPattern)];

      for (const match of matches) {
        try {
          const parsedRealUrl = parseHttpUrl(decodeURIComponent(match[1]));
          if (!parsedRealUrl) continue;
          if (isBlockedSearchHost(parsedRealUrl.hostname)) continue;
          const realUrl = parsedRealUrl.toString();
          const linkText = collapseWhitespace(htmlToText(match[2]));

          // Skip social media (they block scraping) and DDG internal links
          if (linkText.length < 10) continue;

          items.push({
            sourceType: 'DUCKDUCKGO',
            sourceUrl: realUrl,
            text: `${linkText}\n${realUrl}`,
            fetchedAt: new Date().toISOString(),
          });
        } catch {
          // Skip malformed URLs
        }
      }

      // Rate limit: 500ms between DDG queries to be respectful
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (err) {
      errors.push(`DuckDuckGo "${keyword}" in ${region.id}: ${String(err)}`);
    }
  }

  // Deduplicate by URL
  const seenDdg = new Set<string>();
  const uniqueDdg = items.filter((item) => {
    if (seenDdg.has(item.sourceUrl)) return false;
    seenDdg.add(item.sourceUrl);
    return true;
  });

  return { sourceId: `${strategy.id}:${region.id}`, items: uniqueDdg, errors };
}
