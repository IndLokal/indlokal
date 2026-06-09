import { CommunityCard } from '@/components/CommunityCard';
import { EventCard } from '@/components/EventCard';
import type { CommunityListItem } from '@/modules/community';
import type { EventListItem } from '@/modules/event';
import type { ResourceSearchItem } from '@/modules/search';

type SearchResultsSectionsProps = {
  citySlugForCards?: string;
  savedCommunityIds: Set<string>;
  communities: CommunityListItem[];
  events: EventListItem[];
  resources: ResourceSearchItem[];
  resourceFallbackHref: string;
};

export function SearchResultsSections({
  citySlugForCards,
  savedCommunityIds,
  communities,
  events,
  resources,
  resourceFallbackHref,
}: SearchResultsSectionsProps) {
  return (
    <>
      {communities.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">
            Communities
            <span className="text-muted ml-2 text-sm font-normal">({communities.length})</span>
          </h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {communities.map((community) => (
              <CommunityCard
                key={community.id}
                community={community}
                city={citySlugForCards ?? community.city.slug}
                savedByUser={savedCommunityIds.has(community.id)}
              />
            ))}
          </div>
        </section>
      )}

      {events.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">
            Events
            <span className="text-muted ml-2 text-sm font-normal">({events.length})</span>
          </h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <EventCard key={event.id} event={event} city={citySlugForCards ?? event.city.slug} />
            ))}
          </div>
        </section>
      )}

      {resources.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">
            Resources & guides
            <span className="text-muted ml-2 text-sm font-normal">({resources.length})</span>
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {resources.map((resource) => (
              <a
                key={resource.id}
                href={resource.url ?? resourceFallbackHref}
                {...(resource.url ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="card-base hover:border-brand-300 block p-4 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-foreground text-sm font-semibold">{resource.title}</h3>
                  {resource.isEssential && (
                    <span className="badge-base border-brand-200 text-brand-700 bg-brand-50 shrink-0 px-2 py-0.5 text-xs">
                      Essential
                    </span>
                  )}
                </div>
                {resource.description && (
                  <p className="text-muted mt-1 line-clamp-2 text-sm">{resource.description}</p>
                )}
              </a>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
