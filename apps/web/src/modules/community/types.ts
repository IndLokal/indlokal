import type {
  Community,
  AccessChannel,
  Event,
  Category,
  City,
  Prisma,
  TrustSignal,
} from '@prisma/client';

/** Community with all relations needed for the detail page */
export type CommunityWithRelations = Community & {
  city: City;
  categories: { category: Category }[];
  accessChannels: AccessChannel[];
  events: Event[];
  scoreBreakdown: Prisma.JsonValue;
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

/** Full community for the detail API — includes channels, trust signals */
export type CommunityDetailRow = Pick<
  Community,
  | 'id'
  | 'name'
  | 'slug'
  | 'description'
  | 'descriptionLong'
  | 'status'
  | 'claimState'
  | 'logoUrl'
  | 'coverImageUrl'
  | 'personaSegments'
  | 'languages'
  | 'foundedYear'
  | 'memberCountApprox'
  | 'activityScore'
  | 'completenessScore'
  | 'trustScore'
  | 'isTrending'
  | 'lastActivityAt'
> & {
  city: Pick<City, 'name' | 'slug'>;
  categories: { category: Pick<Category, 'name' | 'slug' | 'icon'> }[];
  accessChannels: Pick<
    AccessChannel,
    'id' | 'channelType' | 'url' | 'label' | 'isPrimary' | 'isVerified'
  >[];
  trustSignals: Pick<TrustSignal, 'id' | 'signalType' | 'createdAt'>[];
  _count: { events: number };
};

/** Lightweight community for the related rail */
export type CommunitySummaryRow = Pick<
  Community,
  'id' | 'name' | 'slug' | 'description' | 'logoUrl' | 'memberCountApprox'
> & {
  city: Pick<City, 'name' | 'slug'>;
  categories: { category: Pick<Category, 'name' | 'slug' | 'icon'> }[];
  _count: { events: number };
};
