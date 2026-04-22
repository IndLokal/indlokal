import type { Metadata } from 'next';
import Link from 'next/link';
import { siteConfig, ACTIVE_CITIES } from '@/lib/config';

export const metadata: Metadata = {
  title: `About — ${siteConfig.name}`,
  description:
    'Learn about IndLokal — the platform connecting the Indian diaspora in Germany with communities, events, and resources.',
};

export default function AboutPage() {
  return (
    <>
      {/* Hero */}
      <section className="from-brand-900 via-brand-800 to-brand-700 relative overflow-hidden bg-gradient-to-br px-4 pt-20 pb-16 text-center">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="bg-brand-500/20 absolute -top-32 -right-32 h-96 w-96 rounded-full blur-3xl" />
          <div className="bg-accent-400/10 absolute -bottom-20 -left-20 h-72 w-72 rounded-full blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-1.5 text-sm font-medium text-white/90 backdrop-blur-sm">
            🇮🇳 Built for Indians in Germany 🇩🇪
          </span>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            About {siteConfig.name}
          </h1>
          <p className="text-brand-200/80 mx-auto mt-4 max-w-xl text-lg leading-relaxed">
            The central hub connecting the Indian diaspora with their local communities across
            Germany.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="mx-auto max-w-3xl px-4 py-16">
        <h2 className="text-foreground text-2xl font-extrabold">Our Mission</h2>
        <p className="text-muted mt-4 leading-relaxed">
          Moving to Germany is exciting — but finding your community shouldn&apos;t be hard. Whether
          you&apos;re looking for a Telugu association, a Diwali celebration, a cricket group, or
          just a WhatsApp group of fellow Indians nearby, {siteConfig.name} makes it effortless to
          discover what&apos;s happening around you.
        </p>
        <p className="text-muted mt-4 leading-relaxed">
          We aggregate communities, events, festivals, and practical expat resources across German
          cities — so you can spend less time searching and more time connecting.
        </p>
      </section>

      {/* What we do */}
      <section className="bg-white px-4 py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-foreground text-2xl font-extrabold">What We Do</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {[
              {
                icon: '🤝',
                title: 'Community Discovery',
                desc: 'Find cultural associations, student groups, WhatsApp communities, sports clubs, and professional networks — all in one place.',
              },
              {
                icon: '📅',
                title: 'Event Aggregation',
                desc: 'Never miss a Holi party, Navratri garba, Diwali celebration, or community meetup. See what\u2019s happening this week.',
              },
              {
                icon: '📋',
                title: 'Expat Resources',
                desc: 'Practical guides for daily life — city registration, finding Indian grocery stores, doctors, tax advisors, and more.',
              },
              {
                icon: '🏛️',
                title: 'Consular Services',
                desc: 'Quick access to passport services, visa information, and official Indian consulate resources in your region.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="from-muted-bg ring-border/40 rounded-2xl bg-gradient-to-br to-white p-6 ring-1"
              >
                <span className="text-3xl">{item.icon}</span>
                <h3 className="text-foreground mt-3 text-lg font-bold">{item.title}</h3>
                <p className="text-muted mt-2 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cities */}
      <section className="mx-auto max-w-3xl px-4 py-16">
        <h2 className="text-foreground text-2xl font-extrabold">Where We Are</h2>
        <p className="text-muted mt-4 leading-relaxed">
          We&apos;re currently live in {ACTIVE_CITIES.length} cities in Baden-Württemberg, with
          plans to expand across Germany.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {ACTIVE_CITIES.map((city) => (
            <Link
              key={city}
              href={`/${city}`}
              className="bg-brand-50 text-brand-700 ring-brand-200/60 hover:bg-brand-100 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold capitalize ring-1 transition-all hover:-translate-y-0.5"
            >
              📍 {city}
            </Link>
          ))}
        </div>
      </section>

      {/* For organizers */}
      <section className="relative overflow-hidden px-4 py-16 text-center">
        <div className="from-brand-600 via-brand-700 to-brand-900 absolute inset-0 bg-gradient-to-br" />
        <div className="relative mx-auto max-w-xl">
          <h2 className="text-2xl font-extrabold text-white sm:text-3xl">
            Run a community or organize events?
          </h2>
          <p className="text-brand-200 mt-4">
            Claim your community page, post events, and reach thousands of Indians in your city —
            completely free.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/submit"
              className="text-brand-700 hover:bg-brand-50 inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-sm font-bold shadow-2xl shadow-black/20 transition-all hover:-translate-y-0.5"
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

      {/* Contact */}
      <section className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h2 className="text-foreground text-2xl font-extrabold">Get in Touch</h2>
        <p className="text-muted mt-4 leading-relaxed">
          Have a question, suggestion, or want to partner with us?
        </p>
        <Link
          href="/contact"
          className="bg-brand-600 shadow-brand-600/25 hover:bg-brand-700 mt-6 inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-sm font-bold text-white shadow-lg transition-all hover:-translate-y-0.5"
        >
          Contact Us →
        </Link>
      </section>
    </>
  );
}
