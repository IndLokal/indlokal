import type { Event, Community, City, Category, TrustSignal } from '@prisma/client';

/** Event with all relations for the detail page */
export type EventWithRelations = Event & {
  community: Pick<Community, 'id' | 'name' | 'slug' | 'logoUrl'> | null;
  city: City;
  categories: { category: Category }[];
};

/** Lightweight event shape for list/card views */
export type EventListItem = Pick<
  Event,
  | 'id'
  | 'title'
  | 'slug'
  | 'startsAt'
  | 'endsAt'
  | 'venueName'
  | 'isOnline'
  | 'cost'
  | 'imageUrl'
  | 'isRecurring'
> & {
  community: Pick<Community, 'name' | 'slug'> | null;
  city: Pick<City, 'name' | 'slug'>;
  categories: { category: Pick<Category, 'name' | 'slug' | 'icon'> }[];
};

/** Full event for the detail API — includes trust signals and related events */
export type EventDetailRow = Pick<
  Event,
  | 'id'
  | 'title'
  | 'slug'
  | 'description'
  | 'status'
  | 'startsAt'
  | 'endsAt'
  | 'venueName'
  | 'venueAddress'
  | 'isOnline'
  | 'onlineLink'
  | 'registrationUrl'
  | 'cost'
  | 'imageUrl'
  | 'isRecurring'
> & {
  community: Pick<Community, 'id' | 'name' | 'slug' | 'logoUrl'> | null;
  city: Pick<City, 'name' | 'slug'>;
  categories: { category: Pick<Category, 'name' | 'slug' | 'icon'> }[];
  trustSignals: Pick<TrustSignal, 'id' | 'signalType' | 'createdAt'>[];
  relatedEvents: EventListItem[];
};
