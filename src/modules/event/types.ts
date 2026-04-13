import type { Event, Community, City, Category } from '@prisma/client';

/** Event with all relations for the detail page */
export type EventWithRelations = Event & {
  community: Pick<Community, 'id' | 'name' | 'slug' | 'logoUrl'> | null;
  city: City;
  categories: { category: Category }[];
};

/** Lightweight event shape for list/card views */
export type EventListItem = Pick<
  Event,
  'id' | 'title' | 'slug' | 'startsAt' | 'endsAt' | 'venueName' | 'isOnline' | 'cost' | 'imageUrl'
> & {
  community: Pick<Community, 'name' | 'slug'> | null;
  city: Pick<City, 'name' | 'slug'>;
  categories: { category: Pick<Category, 'name' | 'slug' | 'icon'> }[];
};
