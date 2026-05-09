import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/lib/db';
import { SubmitForm } from './SubmitForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'List Your Community on IndLokal',
  description:
    'Submit your Indian community, association, or group to IndLokal and help others discover it.',
};

export default async function SubmitPage() {
  const [cities, categories] = await Promise.all([
    db.city.findMany({
      where: { isActive: true },
      select: { slug: true, name: true },
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
        <span className="text-foreground">List your community</span>
      </nav>
      <h1 className="text-foreground text-3xl font-bold tracking-tight">List your community</h1>
      <p className="text-muted mt-3 text-lg leading-relaxed">
        Help others find what you wish you had when you arrived. It takes 2 minutes - our team
        reviews submissions quickly and you&apos;ll be notified when it goes live.
      </p>

      <div className="border-border mt-10 rounded-[var(--radius-card)] border bg-white p-6 shadow-sm sm:p-8">
        <SubmitForm cities={cities} categories={categories} />
      </div>
    </div>
  );
}
