import type { Metadata } from 'next';
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
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-bold">List your community</h1>
      <p className="mt-2 text-gray-600">
        Know an Indian community in Germany that should be on LocalPulse? Fill out the form below
        and our team will review it within a few days.
      </p>

      <div className="mt-8">
        <SubmitForm cities={cities} categories={categories} />
      </div>
    </div>
  );
}
