import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/lib/db';
import { SubmitForm } from './SubmitForm';

export const metadata: Metadata = {
  title: 'List Your Community on LocalPulse',
  description:
    'Submit your Indian community, association, or group to LocalPulse and help others discover it.',
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
        Know an Indian community in Germany that should be on LocalPulse? Fill out the form below
        and our team will review it within a few days.
      </p>

      <div className="border-border mt-10 rounded-[var(--radius-card)] border bg-white p-6 shadow-sm sm:p-8">
        <SubmitForm cities={cities} categories={categories} />
      </div>
    </div>
  );
}
