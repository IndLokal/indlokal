import type { Metadata } from 'next';
import { siteConfig } from '@/lib/config';
import { Footer, SiteHeader } from '@/components/layout';
import { ContributePageContent } from '@/components/contribute/ContributePageContent';

type Props = {
  searchParams: Promise<{ type?: string }>;
};

export const metadata: Metadata = {
  title: `Contribute | ${siteConfig.name}`,
  description: 'Contribute a missing Indian community, event, or resource to IndLokal.',
};

export default async function ContributePage({ searchParams }: Props) {
  const { type } = await searchParams;

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <SiteHeader navLinks={[{ href: '/contribute', label: 'Contribute', highlight: true }]} />

      <main className="w-full flex-1 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <ContributePageContent type={type} />
      </main>

      <Footer />
    </div>
  );
}
