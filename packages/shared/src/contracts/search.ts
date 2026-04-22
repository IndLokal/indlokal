import { z } from 'zod';
import { Page } from './common.js';
import { CommunityCard } from './discovery.js';
import { EventCard } from './discovery.js';

// ─── Enums ─────────────────────────────────────────────────────────────────

export const SearchType = z.enum(['COMMUNITY', 'EVENT', 'ALL']);
export type SearchType = z.infer<typeof SearchType>;

// ─── Suggest ───────────────────────────────────────────────────────────────

export const Suggestion = z.object({
  text: z.string(),
  type: SearchType,
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

export const SearchResultItem = z.discriminatedUnion('type', [
  z.object({ type: z.literal('COMMUNITY'), item: CommunityCard }),
  z.object({ type: z.literal('EVENT'), item: EventCard }),
]);
export type SearchResultItem = z.infer<typeof SearchResultItem>;

// ─── Search page ───────────────────────────────────────────────────────────

export const SearchPage = Page(SearchResultItem);
export type SearchPage = z.infer<typeof SearchPage>;
