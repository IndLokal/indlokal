import Link from 'next/link';
import { siteConfig, ACTIVE_CITIES } from '@/lib/config';
import { NavAuthWidget } from '@/components/NavAuthWidget';
import { Footer } from '@/components/layout';

const CITY_META: Record<string, { emoji: string; tagline: string; gradient: string }> = {
  stuttgart: {
    emoji: '🏰',
    tagline: "Baden-Württemberg's capital",
    gradient: 'from-brand-600 to-brand-800',
  },
  karlsruhe: {
    emoji: '⚡',
    tagline: 'Tech hub of the south',
    gradient: 'from-violet-600 to-violet-800',
  },
  mannheim: {
    emoji: '🎵',
    tagline: 'Culture at the Rhine-Neckar',
    gradient: 'from-fuchsia-600 to-fuchsia-800',
  },
};

export default function HomePage() {
  return (
    <>
      {/* Header */}
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
          <div className="flex items-center gap-3 text-sm">
            <Link href="/submit" className="btn-primary px-4 py-2 text-sm">
              Submit Community
            </Link>
            <NavAuthWidget />
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero — big, bold, colorful */}
        <section className="from-brand-900 via-brand-800 to-brand-700 relative overflow-hidden bg-gradient-to-br px-4 pt-28 pb-32 text-center">
          {/* Decorative blobs */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="bg-brand-500/20 absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full blur-3xl" />
            <div className="bg-accent-400/15 absolute top-1/2 -left-40 h-[400px] w-[400px] rounded-full blur-3xl" />
            <div className="absolute right-1/4 -bottom-20 h-[300px] w-[300px] rounded-full bg-fuchsia-500/10 blur-3xl" />
            {/* Subtle grid pattern */}
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA2MCAwIEwgMCAwIDAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-50" />
          </div>

          <div className="relative mx-auto max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-5 py-2 text-sm font-medium text-white/90 backdrop-blur-sm">
              <span className="bg-accent-400 flex h-2 w-2 animate-pulse rounded-full" />
              🇮🇳 For the Indian community in Germany 🇩🇪
            </span>
            <h1 className="mt-8 text-5xl leading-[1.1] font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl">
              Discover what&apos;s happening{' '}
              <span className="from-accent-300 via-accent-400 bg-gradient-to-r to-orange-300 bg-clip-text text-transparent">
                for Indians
              </span>{' '}
              near you
            </h1>
            <p className="text-brand-200/80 mx-auto mt-6 max-w-xl text-lg leading-relaxed">
              {siteConfig.tagline} Find communities, events, festivals, and resources — all in one
              place.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-4">
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
                Submit Community
              </Link>
            </div>
          </div>
        </section>

        {/* City cards — overlapping hero */}
        <section className="relative z-10 mx-auto -mt-14 max-w-4xl px-4 pb-20">
          <div className="grid gap-5 sm:grid-cols-3">
            {ACTIVE_CITIES.map((city) => {
              const meta = CITY_META[city] ?? {
                emoji: '🏙️',
                tagline: '',
                gradient: 'from-brand-600 to-brand-800',
              };
              return (
                <Link
                  key={city}
                  href={`/${city}`}
                  className="group hover:shadow-brand-500/10 relative flex flex-col items-center gap-4 overflow-hidden rounded-2xl bg-white p-8 text-center shadow-xl ring-1 shadow-black/5 ring-black/[0.04] transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl"
                >
                  {/* Top gradient stripe */}
                  <div
                    className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${meta.gradient}`}
                  />
                  <span
                    className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${meta.gradient} text-3xl shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}
                  >
                    {meta.emoji}
                  </span>
                  <span className="text-foreground group-hover:text-brand-600 text-xl font-extrabold capitalize transition-colors">
                    {city}
                  </span>
                  <span className="text-muted text-sm">{meta.tagline}</span>
                  <span className="text-brand-600 mt-1 inline-flex translate-y-2 items-center gap-1 text-xs font-semibold opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100">
                    Explore →
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Value props — cards with colored backgrounds */}
        <section className="bg-white px-4 py-24">
          <div className="mx-auto max-w-5xl">
            <div className="text-center">
              <span className="bg-brand-100 text-brand-700 inline-block rounded-full px-4 py-1.5 text-xs font-bold tracking-wider uppercase">
                Why LocalPulse
              </span>
              <h2 className="text-foreground mt-4 text-3xl font-extrabold sm:text-4xl">
                Everything the Indian diaspora needs
              </h2>
              <p className="text-muted mx-auto mt-3 max-w-lg">
                One platform to stay connected with your community in Germany
              </p>
            </div>
            <div className="mt-16 grid gap-6 sm:grid-cols-3">
              {[
                {
                  icon: '📅',
                  bg: 'bg-gradient-to-br from-orange-50 to-amber-50',
                  iconBg: 'bg-gradient-to-br from-orange-400 to-amber-500',
                  border: 'ring-orange-200/60',
                  title: 'Events & Festivals',
                  desc: 'Holi, Diwali, Navratri, meetups, workshops — see what\u2019s happening this week.',
                },
                {
                  icon: '🤝',
                  bg: 'bg-gradient-to-br from-brand-50 to-violet-50',
                  iconBg: 'bg-gradient-to-br from-brand-500 to-violet-500',
                  border: 'ring-brand-200/60',
                  title: 'Communities & Groups',
                  desc: 'WhatsApp groups, cultural associations, student networks — find your people.',
                },
                {
                  icon: '📋',
                  bg: 'bg-gradient-to-br from-emerald-50 to-teal-50',
                  iconBg: 'bg-gradient-to-br from-emerald-400 to-teal-500',
                  border: 'ring-emerald-200/60',
                  title: 'Expat Resources',
                  desc: 'City registration, doctors, grocery stores, tax guides — practical help for daily life.',
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className={`${item.bg} rounded-2xl p-8 ring-1 ${item.border} text-center transition-all hover:-translate-y-1 hover:shadow-lg`}
                >
                  <span
                    className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ${item.iconBg} text-3xl shadow-lg`}
                  >
                    {item.icon}
                  </span>
                  <h3 className="text-foreground mt-6 text-lg font-bold">{item.title}</h3>
                  <p className="text-muted mt-2 text-sm leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA — vibrant */}
        <section className="relative overflow-hidden px-4 py-24 text-center">
          <div className="from-brand-600 via-brand-700 to-brand-900 absolute inset-0 bg-gradient-to-br" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.15),transparent_50%)]" />
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA2MCAwIEwgMCAwIDAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-50" />
          <div className="relative mx-auto max-w-xl">
            <h2 className="text-3xl font-extrabold text-white sm:text-4xl">Run a community?</h2>
            <p className="text-brand-200 mt-4 text-lg">
              Claim your community page, post events, and reach more people — free forever.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <Link
                href="/submit"
                className="text-brand-700 hover:bg-brand-50 inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-sm font-bold shadow-2xl shadow-black/20 transition-all hover:-translate-y-0.5 active:scale-[0.98]"
              >
                Submit your community
              </Link>
              <Link
                href="/organizer/login"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-8 py-3.5 text-sm font-bold text-white backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:bg-white/20"
              >
                Organiser login
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
