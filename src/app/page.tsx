import Link from 'next/link';
import { siteConfig, ACTIVE_CITIES } from '@/lib/config';

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">{siteConfig.name}</h1>
        <p className="mt-4 text-lg text-gray-600">{siteConfig.tagline}</p>

        <div className="mt-10">
          <h2 className="text-sm font-semibold tracking-wide text-gray-500 uppercase">
            Choose your city
          </h2>
          <div className="mt-4 flex flex-wrap justify-center gap-4">
            {ACTIVE_CITIES.map((city) => (
              <Link
                key={city}
                href={`/${city}`}
                className="rounded-lg border border-gray-200 px-6 py-3 text-lg font-medium capitalize transition-colors hover:border-gray-400 hover:bg-gray-50"
              >
                {city}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
