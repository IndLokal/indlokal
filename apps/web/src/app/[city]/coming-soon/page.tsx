import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { siteConfig, UPCOMING_CITIES, ACTIVE_CITIES } from '@/lib/config';
import { Footer } from '@/components/layout';
import { NavAuthWidget } from '@/components/NavAuthWidget';

type Props = {
  params: Promise<{ city: string }>;
};

function getUpcomingCity(slug: string) {
  return UPCOMING_CITIES.find((c) => c.slug === slug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city: slug } = await params;
  const city = getUpcomingCity(slug);
  if (!city) return {};
  return {
    title: `${city.name} — Coming Soon | ${siteConfig.name}`,
    description: `${siteConfig.name} is expanding to ${city.name}! Be the first to know when we launch for the Indian community in ${city.name}, Germany.`,
  };
}

export default async function ComingSoonPage({ params }: Props) {
  const { city: slug } = await params;
  const city = getUpcomingCity(slug);

  // If it's not an upcoming city and not active, 404
  if (!city) {
    if (!(ACTIVE_CITIES as readonly string[]).includes(slug)) {
      notFound();
    }
    // Active cities shouldn't land here — redirect handled by layout
    notFound();
  }

  // Nearby active cities to suggest
  const suggestedCities = ACTIVE_CITIES.slice(0, 3);

  return (
    <>
      <header className="border-border/50 sticky top-0 z-40 w-full border-b bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
            <span className="from-brand-500 to-brand-700 shadow-brand-500/20 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-bold text-white shadow-md">
              L
            </span>
            <span className="text-foreground text-xl font-bold tracking-tight">
              {siteConfig.name}
            </span>
          </Link>
          <NavAuthWidget />
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="from-brand-900 via-brand-800 to-brand-700 relative overflow-hidden bg-gradient-to-br px-4 pb-24 pt-20 text-center">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="bg-brand-500/10 absolute -right-32 -top-32 h-96 w-96 rounded-full blur-3xl" />
            <div className="bg-accent-400/5 absolute -bottom-20 -left-20 h-72 w-72 rounded-full blur-3xl" />
          </div>
          <div className="relative mx-auto max-w-2xl">
            <span className="text-5xl">{city.emoji}</span>
            <h1 className="mt-6 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              {city.name} is coming soon
            </h1>
            <p className="text-brand-200/80 mx-auto mt-4 max-w-md text-base leading-relaxed">
              We&apos;re bringing {siteConfig.name} to the Indian community in {city.name},{' '}
              {city.state}. Communities, events, resources — all in one place.
            </p>
          </div>
        </section>

        {/* What to expect */}
        <section className="mx-auto max-w-2xl px-4 py-16 text-center">
          <h2 className="text-foreground text-xl font-bold">What to expect</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              { icon: '🤝', label: 'Local communities' },
              { icon: '📅', label: 'Events & festivals' },
              { icon: '📋', label: 'Expat resources' },
            ].map((item) => (
              <div key={item.label} className="rounded-xl bg-slate-50 p-5 ring-1 ring-black/[0.04]">
                <span className="text-2xl">{item.icon}</span>
                <p className="text-foreground mt-2 text-sm font-medium">{item.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Know a community? */}
        <section className="bg-slate-50 px-4 py-14 text-center">
          <div className="mx-auto max-w-md">
            <h2 className="text-foreground text-lg font-bold">
              Know an Indian community in {city.name}?
            </h2>
            <p className="text-muted mt-2 text-sm leading-relaxed">
              Help us build the {city.name} directory. Submit communities, events, or groups you
              know about — we&apos;ll add them when we launch.
            </p>
            <Link
              href="/submit"
              className="bg-brand-600 hover:bg-brand-700 mt-6 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5"
            >
              Submit a community →
            </Link>
          </div>
        </section>

        {/* Explore active cities */}
        <section className="mx-auto max-w-2xl px-4 py-16 text-center">
          <h2 className="text-foreground text-lg font-bold">
            Explore cities that are already live
          </h2>
          <p className="text-muted mt-2 text-sm">
            Browse communities and events in these cities today.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {suggestedCities.map((c) => (
              <Link
                key={c}
                href={`/${c}`}
                className="text-foreground hover:ring-brand-200 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold capitalize ring-1 ring-black/[0.06] transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                📍 {c}
              </Link>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
