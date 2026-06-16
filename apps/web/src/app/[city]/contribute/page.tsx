import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { ContributePageContent } from '@/components/contribute/ContributePageContent';

type Props = {
  params: Promise<{ city: string }>;
  searchParams: Promise<{ type?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city } = await params;
  const cityData = await db.city.findUnique({
    where: { slug: city },
    select: { name: true },
  });
  const cityName = cityData?.name ?? city.charAt(0).toUpperCase() + city.slice(1);

  return {
    title: `Contribute - ${cityName} · IndLokal`,
    description: `Contribute a missing Indian community or event in ${cityName}.`,
  };
}

export default async function CityContributePage({ params, searchParams }: Props) {
  const [{ city }, { type }] = await Promise.all([params, searchParams]);

  return <ContributePageContent citySlug={city} type={type} />;
}
