import type { Metadata } from 'next';
import Link from 'next/link';
import { content } from '@indlokal/shared';
import { db } from '@/lib/db';
import { SubmitForm } from './SubmitForm';
import { ContentCallout } from '@/components/content/community-actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Add a Community to IndLokal',
  description: 'Add a brand-new Indian community, association, or group to IndLokal for review.',
};

export default async function SubmitPage() {
  const [cities, categories] = await Promise.all([
    db.city.findMany({
      where: {
        OR: [{ isActive: true }, { metroRegionId: { not: null } }],
      },
      select: {
        slug: true,
        name: true,
        metroRegion: { select: { name: true, slug: true } },
      },
      orderBy: { name: 'asc' },
    }),
    db.category.findMany({
      where: { type: 'CATEGORY' },
      select: { slug: true, name: true, icon: true },
      orderBy: { sortOrder: 'asc' },
    }),
  ]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <nav className="text-muted mb-6 text-sm font-medium">
        <Link href="/" className="hover:text-foreground transition-colors">
          Home
        </Link>
        <span className="text-border mx-2">/</span>
        <span className="text-foreground">Add a community</span>
      </nav>
      <h1 className="text-foreground text-3xl font-bold tracking-tight">Add a community</h1>
      <p className="text-muted mt-3 text-lg leading-relaxed">
        {content.COMMUNITY_ACTION_COPY.submitPageLead}
      </p>

      <div className="mt-6">
        <ContentCallout
          title="Who should use this?"
          body={content.COMMUNITY_ACTION_COPY.submitWho}
        />
      </div>

      <div className="border-border mt-10 rounded-[var(--radius-card)] border bg-white p-6 shadow-sm sm:p-8">
        <SubmitForm
          cities={cities.map((city) => ({
            slug: city.slug,
            name: city.metroRegion ? `${city.name} (${city.metroRegion.name} metro)` : city.name,
          }))}
          categories={categories}
        />
      </div>
    </div>
  );
}
