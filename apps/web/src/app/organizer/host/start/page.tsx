import Link from 'next/link';
import { db } from '@/lib/db';
import { HostStartForm } from './HostStartForm';

export const metadata = {
  title: 'Start as Event Host — IndLokal',
  description: 'Sign up as an independent event host. No community required.',
};

export default async function HostStartPage() {
  const cities = await db.city.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  return (
    <div className="flex min-h-screen items-start justify-center bg-gray-50 px-4 py-16">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="bg-brand-500 mx-auto flex h-10 w-10 items-center justify-center rounded-xl font-bold text-white shadow-sm">
            L
          </div>
          <h1 className="mt-4 text-2xl font-bold">Become an event host</h1>
          <p className="text-muted mt-2 text-sm">
            Post your own events on IndLokal — no community required.
          </p>
        </div>

        <div className="card-base p-6 sm:p-8">
          <HostStartForm cities={cities} />
        </div>

        <p className="text-muted mt-6 text-center text-xs">
          Already an organizer?{' '}
          <Link href="/organizer/login" className="underline hover:text-gray-700">
            Log in here
          </Link>
        </p>
      </div>
    </div>
  );
}
