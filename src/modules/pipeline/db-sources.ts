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

/** Channel types we can actually scrape (no auth / API needed) */
const SCRAPEABLE_CHANNEL_TYPES = ['WEBSITE', 'MEETUP'] as const;

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
      status: { in: ['ACTIVE', 'CLAIMED'] },
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

  for (const community of communities) {
    for (const channel of community.accessChannels) {
      // Skip empty/invalid URLs
      if (!channel.url || !channel.url.startsWith('http')) continue;

      strategies.push({
        id: `db-${community.slug}-${channel.channelType.toLowerCase()}`,
        sourceType: 'DB_COMMUNITY',
        kind: 'pinned_url',
        label: `${community.name} (${channel.channelType})`,
        url: channel.url,
        hintCitySlug: community.city.slug,
        enabled: true,
      });
    }
  }

  console.log(
    `[Pipeline] DB sources: ${strategies.length} scrapeable channels from ${communities.length} communities`,
  );
  return strategies;
}
