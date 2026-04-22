import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { SuggestCommunityForm } from './SuggestCommunityForm';

type Props = { params: Promise<{ city: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city } = await params;
  const cityName = city.charAt(0).toUpperCase() + city.slice(1);
  return {
    title: `Suggest a Community — ${cityName} · IndLokal`,
    description: `Know of an Indian community in ${cityName} that isn't listed? Let us know!`,
  };
}

export default async function SuggestCommunityPage({ params }: Props) {
  const { city } = await params;

  const cityData = await db.city.findUnique({
    where: { slug: city },
    select: { name: true, isActive: true },
  });

  if (!cityData || !cityData.isActive) notFound();

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div>
        <nav className="text-muted text-sm">
          <Link
            href={`/${city}`}
            className="hover:text-foreground transition-colors hover:underline"
          >
            {cityData.name}
          </Link>
          {' / '}
          <span className="text-foreground">Suggest a community</span>
        </nav>
        <h1 className="text-foreground mt-4 text-2xl font-bold">Suggest a Community or Service</h1>
        <p className="text-muted mt-2">
          Know of an Indian community, service, or useful resource in {cityData.name} that
          isn&apos;t listed here? Share the details and we&apos;ll look into adding it.
        </p>
      </div>

      <SuggestCommunityForm citySlug={city} />

      <p className="text-muted text-center text-sm">
        Or{' '}
        <Link
          href={`/${city}/communities`}
          className="text-brand-600 hover:text-brand-700 font-medium hover:underline"
        >
          browse existing communities →
        </Link>
      </p>
    </div>
  );
}
