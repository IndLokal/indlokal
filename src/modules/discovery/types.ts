import type { CommunityListItem } from '@/modules/community/types';
import type { EventListItem } from '@/modules/event/types';

/** Full data shape for the city feed page */
export type CityFeedData = {
  city: {
    name: string;
    slug: string;
    state: string;
    diasporaDensityEstimate: number | null;
  };

  /** Events for this week (or this month if sparse) */
  thisWeek: {
    events: EventListItem[];
    expandedToMonth: boolean;
  };

  /** Top communities by activity score */
  activeCommunities: CommunityListItem[];

  /** Recently happened events — proves the city is active */
  recentPastEvents: EventListItem[];

  /** Content counts for the city */
  counts: {
    communities: number;
    upcomingEvents: number;
    categories: number;
  };
};
