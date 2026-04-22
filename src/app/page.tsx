import Link from 'next/link';
import { siteConfig, ACTIVE_CITIES, UPCOMING_CITIES, METRO_REGIONS } from '@/lib/config';
import { NavAuthWidget } from '@/components/NavAuthWidget';
import { LogoMark } from '@/components/Logo';
import { Footer } from '@/components/layout';
import { CitySearch } from './CitySearch';

const CITY_META: Record<string, { emoji: string; tagline: string }> = {
  stuttgart: {
    emoji: '🏰',
    tagline: "Baden-Württemberg's capital",
  },
  karlsruhe: {
    emoji: '⚡',
    tagline: 'Tech hub of the south',
  },
  mannheim: {
    emoji: '🎵',
    tagline: 'Culture at the Rhine-Neckar',
  },
};

export default function HomePage() {
  return (
    <>
      {/* Header */}
      <header className="border-border/50 sticky top-0 z-40 w-full border-b bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
            <LogoMark size={36} className="rounded-xl shadow-sm" />
            <span className="text-foreground text-xl font-bold tracking-tight">
              {siteConfig.name}
            </span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/submit" className="btn-primary inline-flex px-4 py-2 text-sm">
              List a Community
            </Link>
            <NavAuthWidget />
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero — indigo with single saffron accent */}
        <section className="from-brand-900 via-brand-800 to-brand-700 relative overflow-hidden bg-gradient-to-br px-4 pt-16 pb-20 text-center sm:pt-28 sm:pb-32">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="bg-brand-500/20 absolute -top-40 -right-40 hidden h-[500px] w-[500px] rounded-full blur-3xl sm:block" />
            <div className="bg-accent-400/15 absolute top-1/2 -left-40 hidden h-[400px] w-[400px] rounded-full blur-3xl sm:block" />
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA2MCAwIEwgMCAwIDAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-50" />
          </div>

          <div className="relative mx-auto max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-5 py-2 text-sm font-medium text-white/90 backdrop-blur-sm">
              <span className="bg-accent-400 flex h-2 w-2 animate-pulse rounded-full" />
              For the Indian diaspora in Germany
            </span>
            <h1 className="mt-6 text-4xl leading-[1.1] font-extrabold tracking-tight text-white sm:mt-8 sm:text-6xl lg:text-7xl">
              Your Indian community,{' '}
              <span className="from-accent-300 to-accent-500 bg-gradient-to-r bg-clip-text text-transparent">
                locally.
              </span>
            </h1>
            <p className="text-brand-200/90 mx-auto mt-6 max-w-xl text-lg leading-relaxed">
              The communities active in your city, the events worth knowing about this week, and the
              resources every Indian in Germany ends up needing — all in one place.
            </p>

            <div className="mx-auto mt-10 max-w-md">
              <CitySearch />
            </div>

            <div className="mt-6 flex flex-wrap justify-center gap-4">
              <Link
                href={`/${ACTIVE_CITIES[0]}`}
                className="text-brand-700 hover:bg-brand-50 inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-sm font-bold shadow-2xl shadow-black/20 transition-all hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98]"
              >
                Explore Stuttgart →
              </Link>
              <Link
                href="/submit"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-8 py-3.5 text-sm font-bold text-white backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:bg-white/20"
              >
                List a Community
              </Link>
            </div>
          </div>
        </section>

        {/* City selector */}
        <section className="relative z-10 mx-auto -mt-14 max-w-5xl px-4 pb-12">
          <div className="grid gap-4 sm:grid-cols-3">
            {ACTIVE_CITIES.map((city) => {
              const meta = CITY_META[city] ?? { emoji: '🏙️', tagline: '' };
              return (
                <Link
                  key={city}
                  href={`/${city}`}
                  className="group relative flex flex-col items-center gap-3 overflow-hidden rounded-2xl bg-white p-7 text-center shadow-lg ring-1 ring-black/[0.06] transition-all duration-200 hover:-translate-y-1 hover:shadow-xl"
                >
                  <div className="from-brand-500 to-brand-700 absolute inset-x-0 top-0 h-1 bg-gradient-to-r" />
                  <span className="from-brand-500 to-brand-700 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br text-2xl shadow-sm transition-transform duration-200 group-hover:scale-105">
                    {meta.emoji}
                  </span>
                  <span className="text-foreground group-hover:text-brand-600 text-lg font-bold capitalize transition-colors">
                    {city}
                  </span>
                  <span className="text-muted text-sm">{meta.tagline}</span>
                  {METRO_REGIONS[city] && (
                    <span className="text-muted/70 mt-1 text-xs leading-snug">
                      Incl.{' '}
                      {METRO_REGIONS[city].satellites
                        .slice(0, 4)
                        .map((s) => s.name)
                        .join(', ')}
                      {METRO_REGIONS[city].satellites.length > 4 && ' & more'}
                    </span>
                  )}
                  <span className="text-brand-600 mt-0.5 text-xs font-semibold opacity-0 transition-all group-hover:opacity-100">
                    Explore →
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Expanding to more cities */}
        <section className="mx-auto max-w-5xl px-4 pb-20">
          <div className="text-center">
            <h2 className="text-foreground text-xl font-bold sm:text-2xl">
              Expanding across Germany
            </h2>
            <p className="text-muted mx-auto mt-2 max-w-md text-sm">
              We&apos;re bringing {siteConfig.name} to more cities. Click a city to see what&apos;s
              planned.
            </p>
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {UPCOMING_CITIES.map((city) => (
              <Link
                key={city.slug}
                href={`/${city.slug}`}
                className="group hover:ring-brand-200 inline-flex items-center gap-2.5 rounded-xl bg-white px-4 py-3 text-sm ring-1 ring-black/[0.06] transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <span className="text-lg">{city.emoji}</span>
                <span className="text-foreground group-hover:text-brand-600 font-medium transition-colors">
                  {city.name}
                </span>
                <span className="bg-accent-50 text-accent-700 ring-accent-200/60 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1">
                  Soon
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Three pillars */}
        <section className="bg-white px-4 py-24">
          <div className="mx-auto max-w-5xl">
            <div className="text-center">
              <span className="bg-brand-100 text-brand-700 inline-block rounded-full px-4 py-1.5 text-xs font-bold tracking-wider uppercase">
                Three pillars, one place
              </span>
              <h2 className="text-foreground mt-4 text-2xl font-bold sm:text-3xl">
                Communities. Events. Resources.
              </h2>
              <p className="text-muted mx-auto mt-3 max-w-xl">
                Everything in {siteConfig.name} ladders up to one of three pillars. Equal weight,
                ranked by what&apos;s actually alive — not who paid for a listing.
              </p>
            </div>
            <div className="mt-16 grid gap-6 sm:grid-cols-3">
              {[
                {
                  icon: '🪷',
                  title: 'Communities',
                  desc: 'A curated, activity-ranked map of the Indian cultural associations, language groups, religious organisations, student bodies and professional networks alive in your city.',
                },
                {
                  icon: '📅',
                  title: 'Events',
                  desc: "What's happening for Indians this week — from Diwali and garba to cricket leagues and consular camps. Surfaced by freshness, not by who posted last.",
                },
                {
                  icon: '🧭',
                  title: 'Resources',
                  desc: 'Plain-English guides to Anmeldung, Kindergeld, EU Blue Card, GKV vs PKV, Steuererklärung — plus Indian grocers, English-friendly doctors and CGI consular dates.',
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="from-brand-50 ring-brand-100 rounded-2xl bg-gradient-to-br to-white p-8 text-center ring-1 transition-all hover:-translate-y-1 hover:shadow-lg"
                >
                  <span className="from-brand-500 to-brand-700 mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br text-2xl shadow-sm">
                    {item.icon}
                  </span>
                  <h3 className="text-foreground mt-5 text-base font-semibold">{item.title}</h3>
                  <p className="text-muted mt-2 text-sm leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="relative overflow-hidden px-4 py-24 text-center">
          <div className="from-brand-600 via-brand-700 to-brand-900 absolute inset-0 bg-gradient-to-br" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.15),transparent_50%)]" />
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA2MCAwIEwgMCAwIDAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-50" />
          <div className="relative mx-auto max-w-xl">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              The newcomers in your city are already searching for you.
            </h2>
            <p className="text-brand-200 mt-4 text-lg">
              List your community in five minutes. Free, forever, for grassroots Indian groups in
              Germany.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <Link
                href="/submit"
                className="text-brand-700 hover:bg-brand-50 inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-sm font-bold shadow-2xl shadow-black/20 transition-all hover:-translate-y-0.5 active:scale-[0.98]"
              >
                List your community →
              </Link>
              <Link
                href="/organizer/login"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-8 py-3.5 text-sm font-bold text-white backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:bg-white/20"
              >
                Already listed? Sign in
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
