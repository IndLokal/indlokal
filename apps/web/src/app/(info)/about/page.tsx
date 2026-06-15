import type { Metadata } from 'next';
import Link from 'next/link';
import { siteConfig, ACTIVE_CITIES } from '@/lib/config';
import { CommunityActionGrid } from '@/components/content/community-actions';
import { InfoPageHero } from '@/components/info/InfoPageHero';
import {
  ABOUT_TOP_QUESTION_CARDS,
  ABOUT_TOP_QUESTIONS_COPY,
  DISCOVERY_FOUNDATION_CARDS,
  PUBLIC_SITE_SOCIALS,
} from '@/lib/public-site-content';

export const metadata: Metadata = {
  title: `About - ${siteConfig.name}`,
  description:
    'Learn about IndLokal - how we help Indians in Germany navigate life in their city: trusted local communities, the events worth knowing about this week, and the practical expat-life resources you actually need.',
  alternates: {
    canonical: '/about',
  },
};

export default function AboutPage() {
  const sectionContainer = 'mx-auto max-w-5xl px-4';
  const sectionY = 'py-14 sm:py-16';
  const sectionHeadingClass = 'text-foreground text-2xl font-extrabold sm:text-3xl';
  const operatingPrinciples = [
    {
      title: 'City-first and practical',
      desc: 'We organize discovery city by city so recommendations stay local and useful.',
    },
    {
      title: 'Freshness over noise',
      desc: 'Listings are ranked by activity and recency so people see what is actually active now.',
    },
    {
      title: 'Trust over hype',
      desc: 'We prioritize verifiable information and clear next steps over vanity metrics.',
    },
    {
      title: 'Community-first and neutral',
      desc: 'IndLokal is built for the wider Indian community in Germany across different groups and ecosystems.',
    },
  ] as const;

  const howItWorks = [
    {
      title: 'Discover',
      desc: 'Find communities, events, and practical resources relevant to your city.',
    },
    {
      title: 'Evaluate',
      desc: 'Use structured listings and trust signals to decide where to engage.',
    },
    {
      title: 'Participate',
      desc: 'Join communities, attend events, and act on practical city guidance.',
    },
  ] as const;

  return (
    <>
      <InfoPageHero
        badge="Built for Indians in Germany"
        title={`About ${siteConfig.name}`}
        description="Helping Indians in Germany navigate life in their city - trusted local communities, the events worth knowing about this week, and the practical expat-life resources you actually need."
      />

      <section className={`${sectionContainer} py-8 sm:py-10`}>
        <div className="grid items-stretch gap-3 sm:grid-cols-3">
          <div className="ring-border/50 h-full rounded-2xl bg-white p-5 shadow-sm ring-1">
            <p className="text-muted text-xs font-semibold tracking-wide uppercase">Live cities</p>
            <p className="text-foreground mt-2 text-2xl font-extrabold">{ACTIVE_CITIES.length}</p>
          </div>
          <div className="ring-border/50 h-full rounded-2xl bg-white p-5 shadow-sm ring-1">
            <p className="text-muted text-xs font-semibold tracking-wide uppercase">
              Discovery pillars
            </p>
            <p className="text-foreground mt-2 text-2xl font-extrabold">3</p>
            <p className="text-muted mt-1 text-xs">Communities, events, and resources</p>
          </div>
          <div className="ring-border/50 h-full rounded-2xl bg-white p-5 shadow-sm ring-1">
            <p className="text-muted text-xs font-semibold tracking-wide uppercase">Platform</p>
            <p className="text-foreground mt-2 text-2xl font-extrabold">Trust-led</p>
            <p className="text-muted mt-1 text-xs">Human-verified, city-grounded discovery</p>
          </div>
        </div>
      </section>

      {/* Mission and principles */}
      <section className={`bg-white ${sectionY}`}>
        <div className={`${sectionContainer} grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:gap-10`}>
          <div>
            <span className="bg-brand-100 text-brand-700 inline-block rounded-full px-4 py-1.5 text-xs font-bold tracking-wider uppercase">
              Why we built this
            </span>
            <h2 className={`${sectionHeadingClass} mt-4`}>Why does {siteConfig.name} exist?</h2>
            <p className="text-muted mt-4 leading-relaxed">
              Whether you&apos;re looking for a Tamil Sangam, a Diwali celebration, a cricket
              league, or a plain-English walkthrough of your first Anmeldung, {siteConfig.name}{' '}
              helps you quickly discover what&apos;s happening around you.
            </p>
            <p className="text-muted mt-4 leading-relaxed">
              We aggregate communities, events, and consular and expat-life resources across German
              cities, ranked by what&apos;s actually alive, not by who paid for visibility.
            </p>
          </div>
          <div className="from-muted-bg ring-border/50 h-full rounded-2xl bg-gradient-to-br to-white p-6 ring-1">
            <h3 className="text-foreground text-lg font-bold">How we operate</h3>
            <div className="mt-4 space-y-4">
              {operatingPrinciples.map((item) => (
                <div key={item.title}>
                  <p className="text-foreground text-sm font-semibold">{item.title}</p>
                  <p className="text-muted mt-1 text-sm leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Action guide */}
      {/* Discovery foundation: communities, events, resources */}
      <section className={`bg-white ${sectionY}`}>
        <div className={sectionContainer}>
          <div>
            <span className="bg-brand-100 text-brand-700 inline-block rounded-full px-4 py-1.5 text-xs font-bold tracking-wider uppercase">
              What you&apos;ll find in your city
            </span>
            <h2 className={`${sectionHeadingClass} mt-4`}>What can I use in my city?</h2>
            <p className="text-muted mt-3 max-w-2xl leading-relaxed">
              For every German city we cover, {siteConfig.name} brings together three ways into
              local Indian life: the people, what&apos;s happening this week, and the practical
              know-how to settle in.
            </p>
          </div>
          <div className="mt-10 grid items-stretch gap-5 sm:grid-cols-3">
            {DISCOVERY_FOUNDATION_CARDS.map((item) => (
              <div
                key={item.title}
                className="from-brand-50 ring-brand-100 h-full rounded-2xl bg-gradient-to-br to-white p-6 text-center ring-1 transition-all hover:-translate-y-0.5 hover:shadow-lg"
              >
                <span className="from-brand-500 to-brand-700 mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br text-xl shadow-sm">
                  {item.icon}
                </span>
                <h3 className="text-foreground mt-4 text-lg font-bold">{item.title}</h3>
                <p className="text-muted mt-2 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How IndLokal works today */}
      <section className={`bg-muted-bg/40 ${sectionY}`}>
        <div className={sectionContainer}>
          <div>
            <h2 className={sectionHeadingClass}>How do I use IndLokal?</h2>
            <p className="text-muted mt-3 max-w-2xl leading-relaxed">
              A simple flow focused on what is live on the platform today.
            </p>
          </div>
          <div className="mt-8 grid items-stretch gap-4 sm:grid-cols-3">
            {howItWorks.map((item, index) => (
              <div
                key={item.title}
                className="ring-border/50 h-full rounded-2xl bg-white p-6 shadow-sm ring-1"
              >
                <span className="bg-brand-100 text-brand-700 inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold">
                  {index + 1}
                </span>
                <h3 className="text-foreground mt-4 text-lg font-bold">{item.title}</h3>
                <p className="text-muted mt-2 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Action guide */}
      <section className={`bg-white ${sectionY}`}>
        <div className={sectionContainer}>
          <CommunityActionGrid
            title={ABOUT_TOP_QUESTIONS_COPY.title}
            description={ABOUT_TOP_QUESTIONS_COPY.description}
            cards={ABOUT_TOP_QUESTION_CARDS}
            titleClassName={sectionHeadingClass}
          />
        </div>
      </section>

      {/* Cities */}
      <section className={`${sectionContainer} ${sectionY}`}>
        <h2 className={sectionHeadingClass}>Which cities are live?</h2>
        <p className="text-muted mt-4 max-w-3xl leading-relaxed">
          We&apos;re currently live in {ACTIVE_CITIES.length} cities across Germany, with a strong
          footprint in Baden-Wurttemberg and active coverage across key metros.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
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

      {/* Strategic Advisors & Early Ecosystem Support */}
      <section className={`bg-white ${sectionY}`}>
        <div className={sectionContainer}>
          <h2 className={sectionHeadingClass}>Who is behind {siteConfig.name}?</h2>
          <p className="text-muted mt-4 max-w-3xl leading-relaxed">
            IndLokal is built as a neutral, city-first platform for Indians in Germany. We are
            guided by senior leaders and ecosystem contributors with experience across brand
            building, market intelligence, business transformation, community networks, and
            India-Germany ecosystem development.
          </p>
          <p className="text-muted mt-4 max-w-3xl leading-relaxed">
            Our advisors help us think beyond listings - towards trust, discovery, partnerships,
            growth, and long-term platform relevance for Indians in Germany.
          </p>

          <div className="mt-8 grid items-stretch gap-5 sm:grid-cols-2">
            <div className="from-brand-50 ring-brand-100 h-full rounded-2xl bg-gradient-to-br to-white p-6 ring-1">
              <h3 className="text-foreground text-lg font-bold">
                Strategic Advisor - Brand, Growth &amp; Market Intelligence
              </h3>
              <p className="text-muted mt-2 text-sm leading-relaxed">
                Senior marketing and analytics leader with experience across automotive brand
                building, customer insights, market intelligence, positioning, and data-led growth.
              </p>
            </div>
            <div className="from-brand-50 ring-brand-100 h-full rounded-2xl bg-gradient-to-br to-white p-6 ring-1">
              <h3 className="text-foreground text-lg font-bold">
                Strategic Advisor - Business Transformation &amp; Ecosystem Partnerships
              </h3>
              <p className="text-muted mt-2 text-sm leading-relaxed">
                Senior consulting and transformation leader advising on business strategy, operating
                model, ecosystem partnerships, enterprise connects, and scale-up guidance.
              </p>
            </div>
          </div>

          <div className="mt-10 rounded-2xl border border-gray-100 bg-gray-50 p-6">
            <h3 className="text-foreground text-lg font-bold">Early Ecosystem Support</h3>
            <p className="text-muted mt-2 leading-relaxed">
              In Stuttgart, IndLokal has benefited from early community, youth, and
              business-networking inputs from the JITO Stuttgart ecosystem.
            </p>
            <p className="text-muted mt-3 text-sm leading-relaxed">
              IndLokal remains a neutral platform built for the wider Indian community in Germany.
            </p>
          </div>

          <div className="mt-10">
            <h3 className="text-foreground text-lg font-bold">Built from the community</h3>
            <p className="text-muted mt-2 leading-relaxed">
              IndLokal grew from a simple observation: Indian communities, events, services, and
              business opportunities exist across Germany, but they are hard to discover in one
              trusted place.
            </p>
          </div>
        </div>
      </section>

      {/* For organizers */}
      <section className={`relative overflow-hidden ${sectionY}`}>
        <div className="from-brand-600 via-brand-700 to-brand-900 absolute inset-0 bg-gradient-to-br" />
        <div className={`relative ${sectionContainer}`}>
          <div className="ring-border/20 rounded-3xl border border-white/10 bg-white/5 px-6 py-8 text-left backdrop-blur-sm sm:px-10 sm:py-10">
            <h2 className="text-2xl font-extrabold text-white sm:text-3xl">
              I run a community - what should I do?
            </h2>
            <p className="text-brand-200 mt-4 max-w-2xl">
              Claim your community page, post events, and reach thousands of Indians in your city -
              completely free.
            </p>
            <div className="mt-8 flex flex-wrap justify-start gap-4">
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
        </div>
      </section>

      {/* Contact */}
      <section className={`${sectionContainer} ${sectionY}`}>
        <div className="mb-8">
          <h2 className={sectionHeadingClass}>How can I contact IndLokal?</h2>
          <p className="text-muted mt-3 max-w-2xl leading-relaxed">
            Reach the team directly or follow IndLokal updates across our channels.
          </p>
        </div>
        <div className="grid items-stretch gap-5 sm:grid-cols-3">
          <Link
            href="/contact"
            className="ring-border/50 flex h-full flex-col rounded-2xl bg-white p-6 shadow-sm ring-1 transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <p className="text-foreground text-lg font-bold">Contact the team</p>
            <p className="text-muted mt-2 text-sm leading-relaxed">
              Questions, partnerships, or media conversations.
            </p>
            <p className="text-brand-700 mt-auto pt-5 text-sm font-semibold">
              Go to contact page →
            </p>
          </Link>
          <a
            href={PUBLIC_SITE_SOCIALS.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="ring-border/50 flex h-full flex-col rounded-2xl bg-white p-6 shadow-sm ring-1 transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <p className="text-foreground text-lg font-bold">Follow on Instagram</p>
            <p className="text-muted mt-2 text-sm leading-relaxed">
              Stay updated on new listings, updates, and local highlights.
            </p>
            <p className="text-brand-700 mt-auto pt-5 text-sm font-semibold">Open Instagram →</p>
          </a>
          <a
            href={PUBLIC_SITE_SOCIALS.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="ring-border/50 flex h-full flex-col rounded-2xl bg-white p-6 shadow-sm ring-1 transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <p className="text-foreground text-lg font-bold">Connect on LinkedIn</p>
            <p className="text-muted mt-2 text-sm leading-relaxed">
              Follow company updates and ecosystem collaboration milestones.
            </p>
            <p className="text-brand-700 mt-auto pt-5 text-sm font-semibold">Open LinkedIn →</p>
          </a>
        </div>
      </section>
    </>
  );
}
