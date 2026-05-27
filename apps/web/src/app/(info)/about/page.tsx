import type { Metadata } from 'next';
import Link from 'next/link';
import { content } from '@indlokal/shared';
import { siteConfig, ACTIVE_CITIES } from '@/lib/config';
import { CommunityActionGrid } from '@/components/content/community-actions';
import { InfoPageHero } from '@/components/info/InfoPageHero';

export const metadata: Metadata = {
  title: `About - ${siteConfig.name}`,
  description:
    'Learn about IndLokal - the city-first discovery platform for the Indian diaspora in Germany. Communities, events & expat-life resources, active near you.',
};

export default function AboutPage() {
  const lastReviewed = '27 May 2026';
  const actionCards = content.ACTION_GRID_ORDER.map((id) => content.COMMUNITY_ACTIONS[id]);

  return (
    <>
      <InfoPageHero
        badge="Built for Indians in Germany"
        title={`About ${siteConfig.name}`}
        description="The city-first discovery platform for the Indian diaspora in Germany - communities, events and expat-life resources, active near you."
        meta={`Last reviewed: ${lastReviewed}`}
      />

      {/* Mission */}
      <section className="mx-auto max-w-3xl px-4 py-12 sm:py-14">
        <h2 className="text-foreground text-2xl font-extrabold">Our Mission</h2>
        <p className="text-muted mt-4 leading-relaxed">
          Make Indian community life in Germany visible, fresh, and easy to join - and put the
          practical resources around it within reach. Whether you&apos;re looking for a Tamil
          Sangam, a Diwali celebration, a cricket league, or a plain-English walkthrough of your
          first Anmeldung, {siteConfig.name} makes it effortless to discover what&apos;s happening
          around you.
        </p>
        <p className="text-muted mt-4 leading-relaxed">
          We aggregate communities, events, and consular &amp; expat-life resources across German
          cities - ranked by what&apos;s actually alive, not by who paid for a directory listing.
        </p>
      </section>

      {/* Action guide */}
      <section className="bg-white px-4 py-12 sm:py-14">
        <div className="mx-auto max-w-6xl">
          <CommunityActionGrid
            title="Which action should I use?"
            description={content.COMMUNITY_ACTION_COPY.aboutDescription}
            cards={actionCards}
          />
        </div>
      </section>

      {/* Three pillars */}
      <section className="bg-white px-4 py-12 sm:py-14">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-foreground text-2xl font-extrabold">Three pillars, one place</h2>
          <p className="text-muted mt-3 leading-relaxed">
            For every German city we cover, {siteConfig.name} brings together three things in one
            place - with equal weight.
          </p>
          <div className="mt-8 grid gap-5 sm:grid-cols-3">
            {[
              {
                icon: '🪷',
                title: 'Communities',
                desc: 'Cultural associations, language groups, religious organisations, student bodies, sports clubs, professional networks - ranked by activity.',
              },
              {
                icon: '📅',
                title: 'Events',
                desc: "What's happening this week - from Diwali and garba to cricket leagues and consular camps. Surfaced by freshness, not by who posted last.",
              },
              {
                icon: '🧭',
                title: 'Resources',
                desc: 'Plain-English guides for Anmeldung, EU Blue Card, Kindergeld, GKV vs PKV, Steuererklärung - plus Indian grocers, English-friendly doctors, CGI consular dates.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="from-brand-50 ring-brand-100 rounded-2xl bg-gradient-to-br to-white p-6 ring-1"
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
      <section className="mx-auto max-w-3xl px-4 py-12 sm:py-14">
        <h2 className="text-foreground text-2xl font-extrabold">Where We Are</h2>
        <p className="text-muted mt-4 leading-relaxed">
          We&apos;re currently live in {ACTIVE_CITIES.length} cities across Germany, with a strong
          footprint in Baden-Württemberg and expansion planned nationwide.
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
      <section className="relative overflow-hidden px-4 py-14 text-center sm:py-16">
        <div className="from-brand-600 via-brand-700 to-brand-900 absolute inset-0 bg-gradient-to-br" />
        <div className="relative mx-auto max-w-xl">
          <h2 className="text-2xl font-extrabold text-white sm:text-3xl">
            Run a community or organize events?
          </h2>
          <p className="text-brand-200 mt-4">
            Claim your community page, post events, and reach thousands of Indians in your city -
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
              Organizer login
            </Link>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="mx-auto max-w-3xl px-4 py-12 text-center sm:py-14">
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
