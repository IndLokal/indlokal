import type { Metadata } from 'next';
import Link from 'next/link';
import { siteConfig } from '@/lib/config';

export const metadata: Metadata = {
  title: `Contact — ${siteConfig.name}`,
  description: `Get in touch with the ${siteConfig.name} team.`,
};

export default function ContactPage() {
  return (
    <>
      {/* Hero */}
      <section className="from-brand-900 via-brand-800 to-brand-700 relative overflow-hidden bg-gradient-to-br px-4 pt-20 pb-16 text-center">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="bg-brand-500/20 absolute -top-32 -right-32 h-96 w-96 rounded-full blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-xl">
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Contact Us
          </h1>
          <p className="text-brand-200/80 mx-auto mt-4 max-w-md text-lg leading-relaxed">
            Have a question, suggestion, or want to work with us? We&apos;d love to hear from you.
          </p>
        </div>
      </section>

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
              href="mailto:contact@indlokal.de"
              className="text-brand-600 hover:text-brand-700 mt-4 inline-flex items-center gap-2 text-sm font-bold hover:underline"
            >
              contact@indlokal.de →
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
              href="mailto:support@indlokal.de"
              className="text-brand-600 hover:text-brand-700 mt-4 inline-flex items-center gap-2 text-sm font-bold hover:underline"
            >
              support@indlokal.de →
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
              href="https://instagram.com/indlokal"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground ring-border/60 hover:ring-brand-300 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold ring-1 transition-all hover:-translate-y-0.5"
            >
              📸 Instagram
            </a>
            <a
              href="https://linkedin.com/company/indlokal"
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
