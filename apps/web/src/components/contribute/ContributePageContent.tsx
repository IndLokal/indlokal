import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { SubmitForm } from '@/app/submit/SubmitForm';
import { ContributeEventForm } from './ContributeEventForm';
import { SuggestHub } from './SuggestHub';

type Props = {
  type?: string;
  citySlug?: string;
  returnType?: string;
  communityName?: string;
};

function selectedContributionType(type?: string): 'community' | 'event' | undefined {
  return type === 'community' || type === 'event' ? type : undefined;
}

function contributionTypeLabel(type?: 'community' | 'event') {
  if (type === 'community') return 'Community';
  if (type === 'event') return 'Event';
  return null;
}

export async function ContributePageContent({ type, citySlug, returnType, communityName }: Props) {
  const selectedType = selectedContributionType(type);
  const cityData = citySlug
    ? await db.city.findUnique({
        where: { slug: citySlug },
        select: { id: true, slug: true, name: true, isActive: true },
      })
    : null;

  if (citySlug && (!cityData || !cityData.isActive)) notFound();

  const [cities, categories, communities] = await Promise.all([
    db.city.findMany({
      where: {
        OR: [{ isActive: true }, { metroRegionId: { not: null } }],
      },
      select: { id: true, slug: true, name: true },
      orderBy: { name: 'asc' },
    }),
    db.category.findMany({
      where: { type: 'CATEGORY' },
      select: { slug: true, name: true, icon: true },
      orderBy: { sortOrder: 'asc' },
    }),
    db.community.findMany({
      where: {
        mergedIntoId: null,
        city: { isActive: true },
        status: { not: 'INACTIVE' },
      },
      select: { id: true, name: true, cityId: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const baseHref = cityData ? `/${cityData.slug}/contribute` : '/contribute';
  const selectedTypeLabel = contributionTypeLabel(selectedType);
  const eventReturnHrefTemplate = `${baseHref}?type=event&communityName={communityName}`;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <nav className="text-muted text-sm">
          <Link
            href={cityData ? `/${cityData.slug}` : '/'}
            className="hover:text-foreground transition-colors hover:underline"
          >
            {cityData?.name ?? 'Home'}
          </Link>
          {' / '}
          <Link href={baseHref} className="hover:text-foreground transition-colors hover:underline">
            Contribute
          </Link>
          {selectedTypeLabel ? (
            <>
              {' / '}
              <span className="text-foreground">{selectedTypeLabel}</span>
            </>
          ) : null}
        </nav>
        <h1 className="text-foreground mt-4 text-2xl font-bold">
          Help us find what&apos;s missing
        </h1>
        <p className="text-muted mt-2">
          {cityData
            ? `Contribute a community or event in ${cityData.name}.`
            : 'Contribute a community or event. The form will ask for the city where it belongs.'}
        </p>
      </div>

      {!selectedType ? (
        <SuggestHub baseHref={baseHref} />
      ) : selectedType === 'community' ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-foreground mb-6 text-lg font-bold">Contribute a community</h2>
          <SubmitForm
            cities={cities.map((city) => ({ slug: city.slug, name: city.name }))}
            categories={categories}
            defaultCitySlug={cityData?.slug}
            successHref={
              returnType === 'event' ? `${baseHref}?type=event` : `${baseHref}?type=community`
            }
            successHrefTemplate={returnType === 'event' ? eventReturnHrefTemplate : undefined}
            successLabel={
              returnType === 'event' ? 'Back to event form' : 'Contribute another community'
            }
            cancelHref={baseHref}
            cancelLabel="Back to contribute"
          />
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-foreground mb-6 text-lg font-bold">Contribute an event</h2>
          <ContributeEventForm
            citySlug={cityData?.slug}
            cityId={cityData?.id}
            cityName={cityData?.name}
            cities={cities.map((city) => ({ id: city.id, slug: city.slug, name: city.name }))}
            communities={communities}
            prefillCommunityName={communityName}
            categories={categories}
          />
        </div>
      )}

      {cityData ? (
        <p className="text-muted text-center text-sm">
          Or{' '}
          <Link
            href={`/${cityData.slug}/communities`}
            className="text-brand-600 hover:text-brand-700 font-medium hover:underline"
          >
            browse existing communities {'->'}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
