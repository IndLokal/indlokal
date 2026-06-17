import { z } from 'zod';
import { IsoDateTime, Page } from './common';
import { CommunityCard } from './discovery';
import { EventCard } from './discovery';
import { ResourceType } from './resources';

// ─── Enums ─────────────────────────────────────────────────────────────────

export const SearchType = z.enum(['COMMUNITY', 'EVENT', 'RESOURCE', 'ALL']);
export type SearchType = z.infer<typeof SearchType>;

// ─── Autocomplete suggestions ──────────────────────────────────────────────

export const Suggestion = z.object({
  text: z.string(),
  type: SearchType,
  slug: z.string().optional(),
});
export type Suggestion = z.infer<typeof Suggestion>;

// ─── Search query ──────────────────────────────────────────────────────────

export const SearchQuery = z.object({
  q: z.string().min(1).max(200),
  citySlug: z.string().optional(),
  category: z.string().optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  type: SearchType.optional().default('ALL'),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});
export type SearchQuery = z.infer<typeof SearchQuery>;

// ─── Search result item ────────────────────────────────────────────────────

/**
 * Lightweight resource shape returned by unified search (PRD/TDD-0048).
 * Resources are scope-based (national/state/city guides), so `city` is
 * nullable for global/country-wide entries.
 */
export const SearchResourceItem = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  resourceType: ResourceType,
  url: z.string().nullable(),
  description: z.string().nullable(),
  isEssential: z.boolean(),
  createdAt: IsoDateTime,
  city: z.object({ name: z.string(), slug: z.string() }).nullable(),
});
export type SearchResourceItem = z.infer<typeof SearchResourceItem>;

export const SearchResultItem = z.discriminatedUnion('type', [
  z.object({ type: z.literal('COMMUNITY'), item: CommunityCard }),
  z.object({ type: z.literal('EVENT'), item: EventCard }),
  z.object({ type: z.literal('RESOURCE'), item: SearchResourceItem }),
]);
export type SearchResultItem = z.infer<typeof SearchResultItem>;

// ─── Search page ───────────────────────────────────────────────────────────

export const SearchPage = Page(SearchResultItem);
export type SearchPage = z.infer<typeof SearchPage>;
