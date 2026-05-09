import type { MetadataRoute } from 'next';
import { db } from '@/lib/db';
import { siteConfig, UPCOMING_CITIES, RESOURCE_CATEGORIES } from '@/lib/config';

export const dynamic = 'force-dynamic';

type SitemapCity = { slug: string; updatedAt: Date };
type SitemapCommunity = {
  slug: string;
  updatedAt: Date;
  city: { slug: string };
  languages: string[] | null;
};
type SitemapEvent = {
  slug: string;
  updatedAt: Date;
  city: { slug: string };
};

function isMissingTableError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2021';
}

async function loadSitemapData(): Promise<{
  cities: SitemapCity[];
  communities: SitemapCommunity[];
  events: SitemapEvent[];
}> {
  try {
    const [cities, communities, events] = await Promise.all([
      db.city.findMany({
        where: { isActive: true },
        select: { slug: true, updatedAt: true },
      }),
      db.community.findMany({
        where: { status: { not: 'INACTIVE' } },
        select: { slug: true, updatedAt: true, city: { select: { slug: true } }, languages: true },
      }),
      db.event.findMany({
        where: { status: { not: 'CANCELLED' } },
        select: { slug: true, updatedAt: true, city: { select: { slug: true } } },
      }),
    ]);

    return { cities, communities, events };
  } catch (error) {
    if (isMissingTableError(error)) {
      console.warn(
        '[sitemap] Database schema is not ready; returning static sitemap entries only.',
      );
      return { cities: [], communities: [], events: [] };
    }
    throw error;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = siteConfig.url;

  const { cities, communities, events } = await loadSitemapData();

  const entries: MetadataRoute.Sitemap = [];

  // Root
  entries.push({ url: baseUrl, changeFrequency: 'weekly', priority: 1.0 });

  // Submit page
  entries.push({ url: `${baseUrl}/submit`, changeFrequency: 'monthly', priority: 0.6 });

  // Static pages
  entries.push({ url: `${baseUrl}/about`, changeFrequency: 'monthly', priority: 0.5 });
  entries.push({ url: `${baseUrl}/contact`, changeFrequency: 'monthly', priority: 0.4 });
  entries.push({ url: `${baseUrl}/privacy`, changeFrequency: 'yearly', priority: 0.3 });
  entries.push({ url: `${baseUrl}/terms`, changeFrequency: 'yearly', priority: 0.3 });
  entries.push({ url: `${baseUrl}/impressum`, changeFrequency: 'yearly', priority: 0.3 });

  // Upcoming cities — coming soon pages
  for (const city of UPCOMING_CITIES) {
    entries.push({
      url: `${baseUrl}/${city.slug}/coming-soon`,
      changeFrequency: 'monthly',
      priority: 0.4,
    });
  }

  for (const city of cities) {
    const cityBase = `${baseUrl}/${city.slug}`;

    // City feed
    entries.push({
      url: cityBase,
      lastModified: city.updatedAt,
      changeFrequency: 'daily',
      priority: 0.9,
    });

    // Static sub-pages
    entries.push({
      url: `${cityBase}/events`,
      changeFrequency: 'daily',
      priority: 0.8,
    });
    entries.push({
      url: `${cityBase}/communities`,
      changeFrequency: 'weekly',
      priority: 0.8,
    });
    entries.push({
      url: `${cityBase}/indian-events-this-week`,
      changeFrequency: 'daily',
      priority: 0.7,
    });
    entries.push({
      url: `${cityBase}/consular-services`,
      changeFrequency: 'monthly',
      priority: 0.6,
    });
    // Resource category sub-pages
    entries.push({
      url: `${cityBase}/resources`,
      changeFrequency: 'weekly',
      priority: 0.6,
    });
    for (const cat of RESOURCE_CATEGORIES) {
      entries.push({
        url: `${cityBase}/resources/${cat.slug}`,
        changeFrequency: 'monthly',
        priority: 0.5,
      });
    }
    entries.push({
      url: `${cityBase}/search`,
      changeFrequency: 'weekly',
      priority: 0.4,
    });

    // Programmatic SEO: language-communities pages
    const languagesInCity = new Set<string>();
    for (const c of communities) {
      if (c.city.slug === city.slug && c.languages) {
        for (const lang of c.languages) {
          languagesInCity.add(lang.toLowerCase());
        }
      }
    }
    for (const lang of languagesInCity) {
      entries.push({
        url: `${cityBase}/${lang}-communities`,
        changeFrequency: 'weekly',
        priority: 0.7,
      });
    }
  }

  // Community detail pages
  for (const community of communities) {
    entries.push({
      url: `${baseUrl}/${community.city.slug}/communities/${community.slug}`,
      lastModified: community.updatedAt,
      changeFrequency: 'weekly',
      priority: 0.6,
    });
  }

  // Event detail pages
  for (const event of events) {
    entries.push({
      url: `${baseUrl}/${event.city.slug}/events/${event.slug}`,
      lastModified: event.updatedAt,
      changeFrequency: 'weekly',
      priority: 0.6,
    });
  }

  return entries;
}
