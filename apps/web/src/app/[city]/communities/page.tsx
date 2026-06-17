import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { communityOptions } from '@indlokal/shared';
import { db } from '@/lib/db';
import { buildOffsetPaginationMeta, buildPageHref, parseOffsetPagination } from '@/lib/pagination';
import { countCommunitiesByCity, getCommunitiesByCity } from '@/modules/community';
import { CommunityCard } from '@/components/CommunityCard';
import { CitySubpageHeader } from '@/components/city/CitySubpageHeader';
import { CitySubpageCrossLinks } from '@/components/city/CitySubpageCrossLinks';
import { CitySubpageEmptyState } from '@/components/city/CitySubpageEmptyState';
import { CitySeoTemplateSection } from '@/components/seo/CitySeoTemplateSection';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { getSessionUser } from '@/lib/session';

/**
 * Community Explorer - browse communities in a city.
 * Supports ?category= and ?language= filters.
 * (SEO-friendly language pages like /stuttgart/telugu-communities are rewritten
 *  to /stuttgart/communities?language=telugu)
 *
 * Route: /[city]/communities/
 * Example: /stuttgart/communities/
 * Example: /stuttgart/communities?language=telugu
 * Example: /stuttgart/communities?category=cultural
 */

type Props = {
  params: Promise<{ city: string }>;
  searchParams: Promise<{ language?: string; category?: string; page?: string; pageSize?: string }>;
};

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { city } = await params;
  const { language, category } = await searchParams;
  const cityRow = await db.city.findUnique({ where: { slug: city }, select: { name: true } });
  const cityName = cityRow?.name ?? city;
  const title = `Indian Communities in ${cityName}`;
  const description = `Browse Indian communities, associations, and groups in ${cityName}, Germany.`;
  if (language) {
    const languageName = capitalize(language);
    return {
      title: `${languageName} Communities in ${cityName}`,
      description: `Find ${languageName} communities, groups, and events in ${cityName}, Germany.`,
      alternates: {
        canonical: `/${city}/${encodeURIComponent(language.toLowerCase())}-communities`,
      },
    };
  }
  if (category) {
    const categoryName = capitalize(category);
    return {
      title: `Indian ${categoryName} Groups in ${cityName}`,
      description: `Discover Indian ${categoryName.toLowerCase()} groups, communities, and organizations in ${cityName}, Germany.`,
      alternates: {
        canonical: `/${city}/${encodeURIComponent(category.toLowerCase())}-groups`,
      },
    };
  }
  return {
    title,
    description,
    alternates: {
      canonical: `/${city}/communities`,
    },
    openGraph: {
      title,
      description,
      url: `/${city}/communities`,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function CommunitiesPage({ params, searchParams }: Props) {
  const { city } = await params;
  const sp = await searchParams;
  const { language, category } = sp;
  const pagination = parseOffsetPagination(sp, { defaultPageSize: 24, maxPageSize: 48 });

  const cityRow = await db.city.findUnique({
    where: { slug: city },
    select: { name: true, isActive: true },
  });
  if (!cityRow || !cityRow.isActive) notFound();

  // Normalise language to proper case for DB query (stored as "Telugu", not "telugu")
  const languageName = language ? capitalize(language) : undefined;

  const [totalCount, communities, categories, user] = await Promise.all([
    countCommunitiesByCity(city, { categorySlug: category, language: languageName }),
    getCommunitiesByCity(city, {
      categorySlug: category,
      language: languageName,
      limit: pagination.take,
      offset: pagination.skip,
    }),
    db.category.findMany({
      where: { type: 'CATEGORY' },
      select: { name: true, slug: true, icon: true },
      orderBy: { sortOrder: 'asc' },
    }),
    getSessionUser(),
  ]);
  const cityName = cityRow.name;
  const savedCommunityIds = new Set(
    user?.savedCommunities.map((s: { communityId: string }) => s.communityId) ?? [],
  );

  type CategoryItem = (typeof categories)[number];

  const paginationMeta = buildOffsetPaginationMeta({
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalCount,
    itemCount: communities.length,
  });

  const description =
    totalCount > 0
      ? languageName
        ? `${totalCount} ${languageName}-speaking communit${totalCount !== 1 ? 'ies' : 'y'}`
        : `${totalCount} active Indian communit${totalCount !== 1 ? 'ies' : 'y'} in ${cityName}, Germany.`
      : languageName
        ? `No ${languageName} communities listed yet.`
        : `No Indian communities listed yet in ${cityName}, Germany.`;

  // Helper: build href with a given param toggled/set while preserving others
  function buildFilterHref(key: 'category' | 'language', value: string | null) {
    const params = new URLSearchParams();
    if (key !== 'category' && category) params.set('category', category);
    if (key !== 'language' && language) params.set('language', language);
    if (value) params.set(key, value);
    const qs = params.toString();
    return qs ? `/${city}/communities?${qs}` : `/${city}/communities`;
  }

  const activeFilterSummary = [
    category
      ? `Category: ${categories.find((c: CategoryItem) => c.slug === category)?.name ?? category}`
      : null,
    languageName ? `Language: ${languageName}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="space-y-8">
      <CitySubpageHeader
        city={city}
        cityName={cityName}
        sectionLabel={languageName ? `${languageName} communities` : 'Communities'}
        title={
          languageName
            ? `${languageName} Communities in ${cityName}`
            : `Indian Communities in ${cityName}`
        }
        description={description}
      />

      {/* Mobile filters: expandable panel */}
      <div className="space-y-2 sm:hidden">
        <details className="border-border rounded-[var(--radius-button)] border bg-white p-3">
          <summary className="text-muted cursor-pointer list-none text-sm font-medium marker:hidden">
            {activeFilterSummary ? `Filters: ${activeFilterSummary}` : 'Filter communities'}
          </summary>

          <div className="mt-3 space-y-3">
            {/* Category filter */}
            <div className="space-y-2">
              <p className="text-muted text-xs font-semibold tracking-wide uppercase">Category</p>
              <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                <Link
                  href={buildFilterHref('category', null)}
                  className={`inline-flex shrink-0 items-center rounded-full border px-3 py-2 text-xs font-medium transition-colors active:opacity-70 ${
                    !category
                      ? 'border-brand-600 bg-brand-50 text-brand-700'
                      : 'border-border text-muted hover:border-border hover:text-foreground'
                  }`}
                >
                  All
                </Link>
                {categories.map((cat: CategoryItem) => (
                  <Link
                    key={cat.slug}
                    href={buildFilterHref('category', cat.slug === category ? null : cat.slug)}
                    className={`inline-flex shrink-0 items-center rounded-full border px-3 py-2 text-xs font-medium transition-colors active:opacity-70 ${
                      category === cat.slug
                        ? 'border-brand-600 bg-brand-50 text-brand-700'
                        : 'border-border text-muted hover:border-border hover:text-foreground'
                    }`}
                  >
                    {cat.icon} {cat.name}
                  </Link>
                ))}
              </div>
            </div>

            {/* Language filter */}
            <div className="space-y-2">
              <p className="text-muted text-xs font-semibold tracking-wide uppercase">Language</p>
              <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                <Link
                  href={buildFilterHref('language', null)}
                  className={`inline-flex shrink-0 items-center rounded-full border px-3 py-2 text-xs font-medium transition-colors active:opacity-70 ${
                    !language
                      ? 'border-brand-600 bg-brand-50 text-brand-700'
                      : 'border-border text-muted hover:border-border hover:text-foreground'
                  }`}
                >
                  All
                </Link>
                {communityOptions.COMMUNITY_LANGUAGE_VALUES.map((lang) => {
                  const isActive = languageName === lang;
                  return (
                    <Link
                      key={lang}
                      href={buildFilterHref('language', isActive ? null : lang.toLowerCase())}
                      className={`inline-flex shrink-0 items-center rounded-full border px-3 py-2 text-xs font-medium transition-colors active:opacity-70 ${
                        isActive
                          ? 'border-brand-600 bg-brand-50 text-brand-700'
                          : 'border-border text-muted hover:border-border hover:text-foreground'
                      }`}
                    >
                      {lang}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </details>
      </div>

      {/* Desktop filters */}
      <div className="hidden flex-wrap gap-2 sm:flex">
        {/* Category filter */}
        <Link
          href={buildFilterHref('category', null)}
          className={`inline-flex items-center rounded-full border px-3.5 py-2.5 text-xs font-medium transition-colors active:opacity-70 ${
            !category
              ? 'border-brand-600 bg-brand-50 text-brand-700'
              : 'border-border text-muted hover:border-border hover:text-foreground'
          }`}
        >
          All
        </Link>
        {categories.map((cat: CategoryItem) => (
          <Link
            key={cat.slug}
            href={buildFilterHref('category', cat.slug === category ? null : cat.slug)}
            className={`inline-flex items-center rounded-full border px-3.5 py-2.5 text-xs font-medium transition-colors active:opacity-70 ${
              category === cat.slug
                ? 'border-brand-600 bg-brand-50 text-brand-700'
                : 'border-border text-muted hover:border-border hover:text-foreground'
            }`}
          >
            {cat.icon} {cat.name}
          </Link>
        ))}

        <span className="text-border hidden self-center sm:inline">|</span>

        {/* Language filter */}
        {communityOptions.COMMUNITY_LANGUAGE_VALUES.map((lang) => {
          const isActive = languageName === lang;
          return (
            <Link
              key={lang}
              href={buildFilterHref('language', isActive ? null : lang.toLowerCase())}
              className={`inline-flex items-center rounded-full border px-3.5 py-2.5 text-xs font-medium transition-colors active:opacity-70 ${
                isActive
                  ? 'border-brand-600 bg-brand-50 text-brand-700'
                  : 'border-border text-muted hover:border-border hover:text-foreground'
              }`}
            >
              {lang}
            </Link>
          );
        })}
      </div>

      {/* Community grid */}
      {communities.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {communities.map((community) => (
              <CommunityCard
                key={community.id}
                community={community}
                city={city}
                savedByUser={savedCommunityIds.has(community.id)}
              />
            ))}
          </div>
          <PaginationControls
            meta={paginationMeta}
            getPageHref={(page) => buildPageHref({ searchParams: sp, page })}
          />
        </>
      )}

      {/* Empty state */}
      {communities.length === 0 && (
        <CitySubpageEmptyState
          title={
            languageName
              ? `No ${languageName} communities yet`
              : category
                ? `No communities in this category yet`
                : `No communities listed yet`
          }
          description={
            languageName || category
              ? `Check back soon or browse all ${cityName} communities.`
              : `Check back soon.`
          }
          actions={[
            { href: `/${city}/communities`, label: 'Browse all communities', variant: 'primary' },
          ]}
        />
      )}

      {!language && !category && (
        <CitySeoTemplateSection city={city} cityName={cityName} topic="communities" />
      )}

      <CitySubpageCrossLinks
        lead={{
          text: "Don't see your community?",
          href: `/${city}/contribute?type=community`,
          label: 'Contribute one →',
        }}
        links={[{ href: `/${city}/events`, label: 'Browse events →' }]}
      />
    </div>
  );
}
