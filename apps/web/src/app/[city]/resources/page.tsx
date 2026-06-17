import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { RESOURCE_CATEGORIES } from '@/lib/config';
import { FLAGS } from '@/lib/config/flags';
import { EventSaveButton } from '@/components/EventSaveButton';
import { ResourceSaveButton } from '@/components/ResourceSaveButton';
import { getCommunitiesByCity } from '@/modules/community/queries';
import { getUpcomingEvents } from '@/modules/event/queries';
import { getResourcesForCity } from '@/modules/resources';
import { getSessionUser } from '@/lib/session';
import { CitySubpageHeader } from '@/components/city/CitySubpageHeader';
import { CitySeoTemplateSection } from '@/components/seo/CitySeoTemplateSection';
import { ResourcesHubViewTracking, ResourcesTrackedLink } from './ResourcesHubTracking';
import { ResourcesResumePrompt } from './ResourcesResumePrompt';
import type { ResourceAudience, ResourceType } from '@prisma/client';

/**
 * Resources Hub - category card grid + journey checklist.
 *
 * Route: /[city]/resources/
 * Example: /stuttgart/resources/
 *
 * Now driven by the resolver (PRD/TDD-0030), so counts include CITY +
 * METRO + STATE + COUNTRY rows (with consulate filtering) - satellite
 * cities like Karlsruhe inherit Stuttgart's metro rows automatically.
 */

type Props = {
  params: Promise<{ city: string }>;
  searchParams: Promise<{ persona?: string; intent?: string }>;
};

const PERSONA_PRESETS: Record<string, { label: string; audiences: ResourceAudience[] }> = {
  student: { label: 'Student', audiences: ['STUDENT', 'STUDENT_VISA'] },
  family: { label: 'Family', audiences: ['FAMILY'] },
  employee: { label: 'Employee', audiences: ['EMPLOYEE'] },
  founder: { label: 'Founder', audiences: ['FOUNDER'] },
  newcomer: { label: 'Newcomer', audiences: ['NEWCOMER'] },
};

const INTENT_PRESETS: Record<string, { label: string; types: ResourceType[] }> = {
  anmeldung: { label: 'Anmeldung', types: ['CITY_REGISTRATION'] },
  housing: { label: 'Housing', types: ['HOUSING'] },
  health: { label: 'Health', types: ['HEALTH_DOCTORS'] },
  visa: { label: 'Visa', types: ['VISA_SERVICE', 'CONSULAR_SERVICE'] },
  tax: { label: 'Tax', types: ['TAX_FINANCE'] },
  jobs: { label: 'Jobs', types: ['JOBS_CAREERS'] },
};

/** Top guides shown as quick-access links */
const POPULAR_GUIDES = [
  { slug: 'guide-anmeldung-stuttgart', label: 'Anmeldung Guide', icon: '📋' },
  { slug: 'guide-eu-blue-card', label: 'EU Blue Card', icon: '💳' },
  { slug: 'guide-kindergeld-non-eu', label: 'Kindergeld', icon: '👶' },
  { slug: 'guide-health-insurance-gkv-pkv', label: 'Health Insurance', icon: '🏥' },
  { slug: 'guide-steuererklaerung-basics', label: 'Tax Return', icon: '💰' },
  { slug: 'guide-apartment-search-stuttgart', label: 'Apartment Search', icon: '🏠' },
];

function isResourceStale(freshnessState: string): boolean {
  return freshnessState !== 'IN_TTL';
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city } = await params;
  const cityRow = await db.city.findUnique({ where: { slug: city }, select: { name: true } });
  const cityName = cityRow?.name ?? city;
  return {
    title: `Indian Expat Resources in ${cityName}`,
    description: `Practical guides for Indians in ${cityName} - city registration, driving licence, health insurance, taxes, Kindergeld, housing, grocery stores, and more.`,
    alternates: {
      canonical: `/${city}/resources`,
    },
  };
}

function withFilterHref(city: string, key: 'persona' | 'intent', value?: string): string {
  if (!value) return `/${city}/resources`;
  return `/${city}/resources?${key}=${encodeURIComponent(value)}`;
}

export default async function ResourcesHubPage({ params, searchParams }: Props) {
  const { city } = await params;
  const qp = await searchParams;

  const cityRow = await db.city.findUnique({
    where: { slug: city },
    select: { name: true, isActive: true },
  });
  if (!cityRow || !cityRow.isActive) notFound();

  const cityName = cityRow.name;
  const user = await getSessionUser();
  const savedEventIds = new Set(user?.savedEvents.map((row) => row.eventId) ?? []);
  const savedResourceIds = new Set(user?.savedResources.map((row) => row.resourceId) ?? []);
  const selectedPersona = qp.persona?.toLowerCase();
  const selectedIntent = qp.intent?.toLowerCase();

  // Single resolver call → full resource set (CITY+METRO+STATE+COUNTRY).
  const resources = await getResourcesForCity(city);

  const personaCfg = selectedPersona ? PERSONA_PRESETS[selectedPersona] : undefined;
  const intentCfg = selectedIntent ? INTENT_PRESETS[selectedIntent] : undefined;

  const contextFiltered = resources.filter((r) => {
    const personaOk = !personaCfg || r.audiences.some((a) => personaCfg.audiences.includes(a));
    const intentOk = !intentCfg || intentCfg.types.includes(r.resourceType);
    return personaOk && intentOk;
  });

  const visibleResources = selectedPersona || selectedIntent ? contextFiltered : resources;

  // Count by resourceType.
  const countMap: Record<string, number> = {};
  for (const r of visibleResources) {
    countMap[r.resourceType] = (countMap[r.resourceType] ?? 0) + 1;
  }

  const consularCount = visibleResources.filter(
    (r) => r.trust.trustBand === 'STRONG_SOURCE',
  ).length;
  const popularBySlug = new Map(
    visibleResources
      .filter((r) => POPULAR_GUIDES.some((g) => g.slug === r.slug))
      .map((r) => [r.slug, r]),
  );

  const essentialsCandidate = visibleResources.filter((r) => r.isEssential);
  const essentials =
    essentialsCandidate.length > 0 ? essentialsCandidate : resources.filter((r) => r.isEssential);
  const essentialsCount = essentials.length;

  const journeyActionCandidates = essentials.slice(0, 8).map((resource) => {
    const categorySlug =
      RESOURCE_CATEGORIES.find((category) => category.type === resource.resourceType)?.slug ??
      'city-registration';
    return {
      id: resource.id,
      title: resource.title,
      href: `/${city}/resources/${categorySlug}#${resource.slug}`,
    };
  });

  const relatedCategorySlug =
    (intentCfg
      ? RESOURCE_CATEGORIES.find((category) => intentCfg.types.includes(category.type))?.slug
      : undefined) ??
    RESOURCE_CATEGORIES.find((category) => essentials.some((r) => r.resourceType === category.type))
      ?.slug;
  const relatedCategory = relatedCategorySlug
    ? RESOURCE_CATEGORIES.find((category) => category.slug === relatedCategorySlug)
    : undefined;
  const [relatedCommunities, relatedEvents] = relatedCategorySlug
    ? await Promise.all([
        getCommunitiesByCity(city, { categorySlug: relatedCategorySlug, limit: 2 }),
        getUpcomingEvents(city, { categorySlug: relatedCategorySlug, limit: 2 }),
      ])
    : [[], []];

  const totalGuides = visibleResources.length;

  return (
    <div className="space-y-10">
      <ResourcesHubViewTracking
        city={city}
        persona={selectedPersona}
        intent={selectedIntent}
        ctaEnabled={FLAGS.resourcesActionCtaEnabled}
      />

      <CitySubpageHeader
        city={city}
        cityName={cityName}
        sectionLabel="Resources"
        title={`Indian Expat Resources in ${cityName}`}
        description={`${totalGuides} practical guides on everything an Indian expat needs in ${cityName}${selectedPersona || selectedIntent ? ' for your selected context' : ''} - from Anmeldung to Kindergeld.`}
      />

      <ResourcesResumePrompt
        city={city}
        cityName={cityName}
        candidates={journeyActionCandidates}
        enabled={FLAGS.resourcesJourneyResumeEnabled}
      />

      {FLAGS.resourcesIntentEnabled && (
        <section>
          <h2 className="text-lg font-semibold">I need help with...</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(INTENT_PRESETS).map(([slug, cfg]) => {
              const active = selectedIntent === slug;
              return (
                <ResourcesTrackedLink
                  key={slug}
                  href={withFilterHref(city, 'intent', active ? undefined : slug)}
                  event="resources_intent_chip_selected"
                  properties={{ city, intent: slug }}
                  persistEntityType="RESOURCE"
                  persistEntityId={`resources_hub:${city}`}
                  className={`rounded-lg px-3 py-2 text-sm ring-1 transition-all ${
                    active
                      ? 'bg-brand-100 text-brand-800 ring-brand-300'
                      : 'text-foreground bg-white ring-black/[0.08] hover:-translate-y-0.5 hover:shadow-sm'
                  }`}
                >
                  {cfg.label}
                </ResourcesTrackedLink>
              );
            })}
          </div>
          {FLAGS.resourcesPersonaEnabled && (
            <details className="mt-3 rounded-lg bg-white px-3 py-2 ring-1 ring-black/[0.06]">
              <summary className="cursor-pointer text-sm font-medium text-slate-700">
                Refine by profile
              </summary>
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(PERSONA_PRESETS).map(([slug, cfg]) => {
                  const active = selectedPersona === slug;
                  return (
                    <ResourcesTrackedLink
                      key={slug}
                      href={withFilterHref(city, 'persona', active ? undefined : slug)}
                      event="resources_persona_selected"
                      properties={{ city, persona: slug }}
                      persistEntityType="RESOURCE"
                      persistEntityId={`resources_hub:${city}`}
                      className={`rounded-lg px-3 py-2 text-sm ring-1 transition-all ${
                        active
                          ? 'bg-brand-600 ring-brand-600 text-white'
                          : 'text-foreground bg-white ring-black/[0.08] hover:-translate-y-0.5 hover:shadow-sm'
                      }`}
                    >
                      {cfg.label}
                    </ResourcesTrackedLink>
                  );
                })}
              </div>
            </details>
          )}
        </section>
      )}

      {/* Newcomer Journey - first 30 days checklist */}
      {essentialsCount > 0 && (
        <section className="border-brand-100 bg-brand-50/60 rounded-2xl border p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-brand-900 text-lg font-semibold">
                New to {cityName}? Start here
              </h2>
              <p className="text-brand-700 mt-1 text-sm">
                {essentialsCount} essential step{essentialsCount === 1 ? '' : 's'} for your first 30
                days - the official ones every Indian newcomer needs.
              </p>
            </div>
            {FLAGS.resourcesActionCtaEnabled ? (
              <ResourcesTrackedLink
                href={`/${city}/resources/journey`}
                event="resource_cta_click"
                properties={{
                  city,
                  cta_surface: 'resources_start_here',
                  cta_position: 'primary',
                  variant: 'action_first_v1',
                }}
                persistEntityType="RESOURCE"
                persistEntityId={`resources_hub:${city}`}
                className="btn-primary self-start px-4 py-2 text-sm sm:shrink-0"
              >
                Continue next step →
              </ResourcesTrackedLink>
            ) : (
              <Link
                href={`/${city}/resources/journey`}
                className="btn-primary self-start px-4 py-2 text-sm sm:shrink-0"
              >
                Open checklist →
              </Link>
            )}
          </div>
          {FLAGS.resourcesActionCtaEnabled && (
            <div className="mt-3">
              <ResourcesTrackedLink
                href={`/${city}/resources`}
                event="resource_cta_click"
                properties={{
                  city,
                  cta_surface: 'resources_start_here',
                  cta_position: 'secondary',
                  variant: 'action_first_v1',
                  action: 'browse_all',
                }}
                persistEntityType="RESOURCE"
                persistEntityId={`resources_hub:${city}`}
                className="text-brand-700 text-sm font-semibold hover:underline"
              >
                Or browse all topics
              </ResourcesTrackedLink>
            </div>
          )}
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {essentials.slice(0, 4).map((r) => {
              const cat = RESOURCE_CATEGORIES.find((c) => c.type === r.resourceType);
              const categorySlug = cat?.slug ?? 'city-registration';
              return (
                <li key={r.slug}>
                  <div className="hover:ring-brand-200 rounded-lg bg-white px-3 py-2.5 ring-1 ring-black/[0.06] transition-all hover:-translate-y-0.5">
                    <ResourcesTrackedLink
                      href={`/${city}/resources/${categorySlug}#${r.slug}`}
                      event="resources_essentials_click"
                      properties={{
                        city,
                        resource_slug: r.slug,
                        resource_type: r.resourceType,
                        is_stale: isResourceStale(r.freshness.state),
                      }}
                      persistEntityType="RESOURCE"
                      persistEntityId={`resources_hub:${city}`}
                      className="group flex items-center gap-3"
                    >
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br ${cat?.color ?? 'from-slate-400 to-slate-500'} text-sm shadow-sm`}
                      >
                        {cat?.icon ?? '✓'}
                      </span>
                      <span className="text-foreground group-hover:text-brand-600 truncate text-sm font-medium transition-colors">
                        {r.title}
                      </span>
                      <span
                        className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          isResourceStale(r.freshness.state)
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {r.freshness.stateLabel}
                      </span>
                    </ResourcesTrackedLink>
                    <div className="mt-2 flex justify-end border-t border-black/[0.06] pt-1.5">
                      <ResourceSaveButton
                        resourceId={r.id}
                        resourceTitle={r.title}
                        saved={savedResourceIds.has(r.id)}
                        citySlug={city}
                        sourceSurface="resources_hub"
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          {essentials.length > 4 && (
            <div className="mt-3">
              <Link
                href={`/${city}/resources/journey`}
                className="text-brand-700 text-sm font-semibold hover:underline"
              >
                View full newcomer checklist
              </Link>
            </div>
          )}

          {(relatedCommunities.length > 0 || relatedEvents.length > 0) && (
            <div className="border-brand-100 mt-6 border-t pt-4">
              <h3 className="text-sm font-semibold tracking-wide text-slate-600 uppercase">
                Related communities and events
                {relatedCategory ? ` for ${relatedCategory.shortTitle}` : ''}
              </h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {relatedCommunities.map((community) => (
                  <ResourcesTrackedLink
                    key={community.id}
                    href={`/${city}/communities/${community.slug}`}
                    event="resources_to_related_click"
                    properties={{
                      city,
                      target_type: 'community',
                      target_id: community.id,
                      category: relatedCategorySlug,
                    }}
                    persistEntityType="COMMUNITY"
                    persistEntityId={community.id}
                    className="group rounded-xl bg-white p-4 ring-1 ring-black/[0.06] transition-all hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-foreground group-hover:text-brand-600 text-sm font-semibold transition-colors">
                        {community.name}
                      </span>
                      {community._count.events > 0 && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                          {community._count.events} upcoming
                        </span>
                      )}
                    </div>
                    {community.description && (
                      <p className="text-muted mt-1 line-clamp-2 text-sm leading-relaxed">
                        {community.description}
                      </p>
                    )}
                  </ResourcesTrackedLink>
                ))}

                {relatedEvents.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-xl bg-white p-4 ring-1 ring-black/[0.06] transition-all hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <ResourcesTrackedLink
                      href={`/${city}/events/${event.slug}`}
                      event="resources_to_related_click"
                      properties={{
                        city,
                        target_type: 'event',
                        target_id: event.id,
                        category: relatedCategorySlug,
                      }}
                      persistEntityType="EVENT"
                      persistEntityId={event.id}
                      className="group block"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-foreground group-hover:text-brand-600 text-sm font-semibold transition-colors">
                          {event.title}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                          {event.startsAt.toLocaleDateString('en-DE', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                      </div>
                      <p className="text-muted mt-1 text-sm leading-relaxed">
                        {event.community ? `${event.community.name} · ` : ''}
                        {event.isOnline ? 'Online' : (event.venueName ?? cityName)}
                      </p>
                    </ResourcesTrackedLink>
                    <div className="mt-3">
                      <EventSaveButton
                        eventId={event.id}
                        saved={savedEventIds.has(event.id)}
                        city={city}
                      />
                      <p className="text-muted mt-2 text-xs">
                        Save this event to keep it handy and receive an in-app reminder before it
                        starts.
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Popular guides - quick access */}
      {POPULAR_GUIDES.some((g) => popularBySlug.has(g.slug)) && (
        <section>
          <h2 className="text-lg font-semibold">Recommended Now</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {POPULAR_GUIDES.filter((g) => popularBySlug.has(g.slug))
              .slice(0, 3)
              .map((guide) => {
                const resource = popularBySlug.get(guide.slug)!;
                const cat = RESOURCE_CATEGORIES.find((c) => c.type === resource.resourceType);
                const categorySlug = cat?.slug ?? 'city-registration';
                return (
                  <ResourcesTrackedLink
                    key={guide.slug}
                    href={`/${city}/resources/${categorySlug}#${guide.slug}`}
                    event="resources_essentials_click"
                    properties={{
                      city,
                      resource_slug: resource.slug,
                      resource_type: resource.resourceType,
                      is_stale: isResourceStale(resource.freshness.state),
                    }}
                    persistEntityType="RESOURCE"
                    persistEntityId={`resources_hub:${city}`}
                    className="hover:ring-brand-200 group inline-flex items-center gap-2 rounded-lg bg-white px-3.5 py-2.5 text-sm ring-1 ring-black/[0.06] transition-all hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <span>{guide.icon}</span>
                    <span className="text-foreground group-hover:text-brand-600 font-medium transition-colors">
                      {guide.label}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                      {resource.trust.sourceLabel}
                    </span>
                  </ResourcesTrackedLink>
                );
              })}
          </div>
          {POPULAR_GUIDES.filter((g) => popularBySlug.has(g.slug)).length > 3 && (
            <details className="mt-3 rounded-lg bg-white px-3 py-2 ring-1 ring-black/[0.06]">
              <summary className="cursor-pointer text-sm font-medium text-slate-700">
                Show more guides
              </summary>
              <div className="mt-3 flex flex-wrap gap-2">
                {POPULAR_GUIDES.filter((g) => popularBySlug.has(g.slug))
                  .slice(3)
                  .map((guide) => {
                    const resource = popularBySlug.get(guide.slug)!;
                    const cat = RESOURCE_CATEGORIES.find((c) => c.type === resource.resourceType);
                    const categorySlug = cat?.slug ?? 'city-registration';
                    return (
                      <ResourcesTrackedLink
                        key={guide.slug}
                        href={`/${city}/resources/${categorySlug}#${guide.slug}`}
                        event="resources_essentials_click"
                        properties={{
                          city,
                          resource_slug: resource.slug,
                          resource_type: resource.resourceType,
                          is_stale: isResourceStale(resource.freshness.state),
                        }}
                        persistEntityType="RESOURCE"
                        persistEntityId={`resources_hub:${city}`}
                        className="hover:ring-brand-200 group inline-flex items-center gap-2 rounded-lg bg-white px-3.5 py-2.5 text-sm ring-1 ring-black/[0.06] transition-all hover:-translate-y-0.5 hover:shadow-md"
                      >
                        <span>{guide.icon}</span>
                        <span className="text-foreground group-hover:text-brand-600 font-medium transition-colors">
                          {guide.label}
                        </span>
                      </ResourcesTrackedLink>
                    );
                  })}
              </div>
            </details>
          )}
        </section>
      )}

      <details className="rounded-xl bg-white p-4 ring-1 ring-black/[0.08]">
        <summary className="cursor-pointer text-base font-semibold text-slate-800">
          Explore all topics and resources
        </summary>

        {/* Category grid */}
        <section className="mt-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {RESOURCE_CATEGORIES.map((cat) => {
              const count = countMap[cat.type] ?? 0;
              return (
                <Link
                  key={cat.slug}
                  href={`/${city}/resources/${cat.slug}`}
                  className="group relative flex flex-col overflow-hidden rounded-xl bg-white p-5 ring-1 ring-black/[0.06] transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
                >
                  <div
                    className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${cat.color} opacity-70`}
                  />
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${cat.color} text-lg shadow-sm`}
                    >
                      {cat.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-foreground group-hover:text-brand-600 text-[15px] font-semibold transition-colors">
                        {cat.shortTitle}
                      </h3>
                      {count > 0 && (
                        <span className="text-muted text-xs">
                          {count} guide{count !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-muted mt-3 text-[13px] leading-relaxed">{cat.description}</p>
                </Link>
              );
            })}

            {/* Consular services - links to existing page */}
            <Link
              href={`/${city}/consular-services`}
              className="group relative flex flex-col overflow-hidden rounded-xl bg-white p-5 ring-1 ring-black/[0.06] transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-red-400 to-rose-500 opacity-70" />
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-red-400 to-rose-500 text-lg shadow-sm">
                  🇮🇳
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-foreground group-hover:text-brand-600 text-[15px] font-semibold transition-colors">
                    Consular Services
                  </h3>
                  {consularCount > 0 && (
                    <span className="text-muted text-xs">
                      {consularCount} resource{consularCount !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
              <p className="text-muted mt-3 text-[13px] leading-relaxed">
                CGI consular camps, passport renewal, VFS appointments, and OCI services.
              </p>
            </Link>
          </div>
        </section>

        {/* CTA */}
        <section className="border-brand-100 bg-brand-50 mt-5 rounded-xl border p-5">
          <h2 className="text-brand-900 font-semibold">Know an Indian service in {cityName}?</h2>
          <p className="text-brand-700 mt-1 text-sm">
            Help fellow Indians discover useful services - grocery stores, doctors, tax consultants,
            and more.
          </p>
          <Link
            href={`/${city}/contribute`}
            className="btn-primary mt-3 inline-block px-4 py-2 text-sm"
          >
            Contribute a service →
          </Link>
        </section>

        <div className="mt-5">
          <CitySeoTemplateSection city={city} cityName={cityName} topic="resources" />
        </div>
      </details>
    </div>
  );
}
