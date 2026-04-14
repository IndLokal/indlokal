import type { Community, AccessChannel, Event, Category, City } from '@prisma/client';

/** Community with all relations needed for the detail page */
export type CommunityWithRelations = Community & {
  city: City;
  categories: { category: Category }[];
  accessChannels: AccessChannel[];
  events: Event[];
};

/** Lightweight community shape for list/card views */
export type CommunityListItem = Pick<
  Community,
  | 'id'
  | 'name'
  | 'slug'
  | 'description'
  | 'status'
  | 'activityScore'
  | 'completenessScore'
  | 'trustScore'
  | 'isTrending'
  | 'claimState'
  | 'memberCountApprox'
  | 'logoUrl'
  | 'lastActivityAt'
  | 'languages'
> & {
  city: Pick<City, 'name' | 'slug'>;
  categories: { category: Pick<Category, 'name' | 'slug' | 'icon'> }[];
  _count: { events: number };
};
