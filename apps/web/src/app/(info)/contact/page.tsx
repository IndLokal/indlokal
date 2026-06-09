import type { Metadata } from 'next';
import Link from 'next/link';
import { siteConfig } from '@/lib/config';
import { InfoPageHero } from '@/components/info/InfoPageHero';
import {
  PUBLIC_SITE_EMAILS,
  PUBLIC_SITE_LAST_REVIEWED,
  PUBLIC_SITE_SOCIALS,
} from '@/lib/public-site-content';

export const metadata: Metadata = {
  title: `Contact - ${siteConfig.name}`,
  description: `Get in touch with the ${siteConfig.name} team.`,
  alternates: {
    canonical: '/contact',
  },
};

export default function ContactPage() {
  return (
    <>
      <InfoPageHero
        title="Contact Us"
        description="Have a question, suggestion, or want to work with us? We'd love to hear from you."
        meta={`Last reviewed: ${PUBLIC_SITE_LAST_REVIEWED}`}
      />

      <div className="mx-auto max-w-3xl px-4 py-16">
        <div className="grid gap-8 sm:grid-cols-2">
          {/* General inquiries */}
          <div className="ring-border/40 rounded-2xl bg-white p-8 shadow-sm ring-1">
            <div className="bg-brand-50 flex h-12 w-12 items-center justify-center rounded-xl text-2xl">
              ✉️
            </div>
            <h2 className="text-foreground mt-4 text-lg font-bold">General Inquiries</h2>
            <p className="text-muted mt-2 text-sm leading-relaxed">
              Questions about {siteConfig.name}, partnerships, or media inquiries.
            </p>
            <a
              href={`mailto:${PUBLIC_SITE_EMAILS.contact}`}
              className="text-brand-600 hover:text-brand-700 mt-4 inline-flex items-center gap-2 text-sm font-bold hover:underline"
            >
              {PUBLIC_SITE_EMAILS.contact} →
            </a>
          </div>

          {/* Community submissions */}
          <div className="ring-border/40 rounded-2xl bg-white p-8 shadow-sm ring-1">
            <div className="bg-accent-50 flex h-12 w-12 items-center justify-center rounded-xl text-2xl">
              🤝
            </div>
            <h2 className="text-foreground mt-4 text-lg font-bold">Community Submissions</h2>
            <p className="text-muted mt-2 text-sm leading-relaxed">
              Want to list your community on {siteConfig.name}? Submit it directly.
            </p>
            <Link
              href="/submit"
              className="text-accent-700 hover:text-accent-800 mt-4 inline-flex items-center gap-2 text-sm font-bold hover:underline"
            >
              Submit a community →
            </Link>
          </div>

          {/* Organizers */}
          <div className="ring-border/40 rounded-2xl bg-white p-8 shadow-sm ring-1">
            <div className="bg-brand-50 flex h-12 w-12 items-center justify-center rounded-xl text-2xl">
              🏛️
            </div>
            <h2 className="text-foreground mt-4 text-lg font-bold">For Organizers</h2>
            <p className="text-muted mt-2 text-sm leading-relaxed">
              Claim your community page and manage events through the organizer dashboard.
            </p>
            <Link
              href="/organizer/login"
              className="text-brand-600 hover:text-brand-700 mt-4 inline-flex items-center gap-2 text-sm font-bold hover:underline"
            >
              Organizer login →
            </Link>
          </div>

          {/* Bug reports */}
          <div className="ring-border/40 rounded-2xl bg-white p-8 shadow-sm ring-1">
            <div className="bg-muted-bg flex h-12 w-12 items-center justify-center rounded-xl text-2xl">
              🐛
            </div>
            <h2 className="text-foreground mt-4 text-lg font-bold">Bug Reports</h2>
            <p className="text-muted mt-2 text-sm leading-relaxed">
              Found an issue or have technical feedback? Let us know.
            </p>
            <a
              href={`mailto:${PUBLIC_SITE_EMAILS.support}`}
              className="text-brand-600 hover:text-brand-700 mt-4 inline-flex items-center gap-2 text-sm font-bold hover:underline"
            >
              {PUBLIC_SITE_EMAILS.support} →
            </a>
          </div>
        </div>

        {/* Social / Community */}
        <div className="from-muted-bg ring-border/40 mt-12 rounded-2xl bg-gradient-to-br to-white p-8 text-center ring-1">
          <h2 className="text-foreground text-xl font-extrabold">Join Our Community</h2>
          <p className="text-muted mx-auto mt-2 max-w-md text-sm leading-relaxed">
            Follow us on social media or join our WhatsApp group to stay updated on new communities
            and events.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <a
              href={PUBLIC_SITE_SOCIALS.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground ring-border/60 hover:ring-brand-300 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold ring-1 transition-all hover:-translate-y-0.5"
            >
              📸 Instagram
            </a>
            <a
              href={PUBLIC_SITE_SOCIALS.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground ring-border/60 hover:ring-brand-300 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold ring-1 transition-all hover:-translate-y-0.5"
            >
              💼 LinkedIn
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
