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

  try {
    const isFacebook = strategy.sourceType === 'FACEBOOK';
    const fetchUrl = isFacebook
      ? strategy.url.replace('www.facebook.com', 'm.facebook.com')
      : strategy.url;

    const res = await fetch(fetchUrl, {
      headers: {
        'User-Agent': isFacebook
          ? 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36'
          : 'LocalPulse-ContentBot/1.0 (+https://localpulse.de)',
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      return { sourceId: strategy.id, items, errors: [`HTTP ${res.status} from ${strategy.url}`] };
    }

    const html = await res.text();

    // Strip noise tags
    const cleaned = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');

    // Extract image URLs
    const imgMatches = [...cleaned.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)];
    const imageUrls = imgMatches
      .map((m) => m[1])
      .filter((u) => u.startsWith('http'))
      .slice(0, 5);

    items.push({
      sourceType: strategy.sourceType,
      sourceUrl: strategy.url,
      text: cleaned
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 15_000),
      imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    errors.push(`Fetch ${strategy.url}: ${String(err)}`);
  }

  return { sourceId: strategy.id, items, errors };
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

  for (const keyword of strategy.keywords) {
    try {
      const query = `${keyword} ${region.searchCenter}`;
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

      const res = await fetch(url, {
        headers: {
          'User-Agent': 'LocalPulse-ContentBot/1.0 (+https://localpulse.de)',
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
          const realUrl = decodeURIComponent(match[1]);
          const linkText = match[2].replace(/<[^>]+>/g, '').trim();

          // Skip social media (they block scraping) and DDG internal links
          if (
            realUrl.includes('facebook.com') ||
            realUrl.includes('instagram.com') ||
            realUrl.includes('duckduckgo.com') ||
            !realUrl.startsWith('http')
          )
            continue;

          // Skip if no meaningful text
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
