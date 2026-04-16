import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { SuggestCommunityForm } from '@/components/SuggestCommunityForm';

type Props = { params: Promise<{ city: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city } = await params;
  const cityName = city.charAt(0).toUpperCase() + city.slice(1);
  return {
    title: `Suggest a Community — ${cityName} · LocalPulse`,
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
        <nav className="text-sm text-gray-500">
          <a href={`/${city}`} className="hover:underline">
            {cityData.name}
          </a>
          {' / '}
          <span className="text-gray-700">Suggest a community</span>
        </nav>
        <h1 className="mt-4 text-2xl font-bold">Suggest a Community or Service</h1>
        <p className="mt-2 text-gray-600">
          Know of an Indian community, service, or useful resource in {cityData.name} that
          isn&apos;t listed here? Share the details and we&apos;ll look into adding it.
        </p>
      </div>

      <SuggestCommunityForm citySlug={city} />
    </div>
  );
}
