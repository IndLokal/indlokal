import type { Metadata } from 'next';
import Link from 'next/link';
import { siteConfig } from '@/lib/config';
import { Footer } from '@/components/layout';
import { NavAuthWidget } from '@/components/NavAuthWidget';

export const metadata: Metadata = {
  title: `Impressum — ${siteConfig.name}`,
  description: `Legal notice (Impressum) for ${siteConfig.name} as required by German law (§ 5 TMG).`,
};

export default function ImpressumPage() {
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
        <div className="mx-auto max-w-3xl px-4 py-16">
          <div className="mb-8">
            <Link
              href="/"
              className="text-brand-600 hover:text-brand-700 text-sm font-medium hover:underline"
            >
              ← Back to Home
            </Link>
          </div>

          <h1 className="text-foreground text-3xl font-extrabold tracking-tight sm:text-4xl">
            Impressum
          </h1>
          <p className="text-muted mt-2 text-sm">Legal Notice pursuant to § 5 TMG</p>

          <div className="prose-legal mt-10 space-y-8">
            <section>
              <h2>Information pursuant to § 5 TMG</h2>
              <p>
                {siteConfig.name}
                <br />
                [Your Full Name / Company Name]
                <br />
                [Street Address]
                <br />
                [Postal Code] [City], Germany
              </p>
            </section>

            <section>
              <h2>Contact</h2>
              <p>
                Email:{' '}
                <a href="mailto:contact@localpulse.de" className="text-brand-600 hover:underline">
                  contact@localpulse.de
                </a>
                <br />
                Website:{' '}
                <a href={siteConfig.url} className="text-brand-600 hover:underline">
                  {siteConfig.url}
                </a>
              </p>
            </section>

            <section>
              <h2>Responsible for Content (§ 55 Abs. 2 RStV)</h2>
              <p>
                [Your Full Name]
                <br />
                [Street Address]
                <br />
                [Postal Code] [City], Germany
              </p>
            </section>

            <section>
              <h2>EU Dispute Resolution</h2>
              <p>
                The European Commission provides a platform for online dispute resolution (OS):{' '}
                <a
                  href="https://ec.europa.eu/consumers/odr/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-600 hover:underline"
                >
                  https://ec.europa.eu/consumers/odr/
                </a>
              </p>
              <p>
                We are not willing or obliged to participate in dispute resolution proceedings
                before a consumer arbitration board.
              </p>
            </section>

            <section>
              <h2>Liability for Content</h2>
              <p>
                As a service provider, we are responsible for our own content on these pages under
                general law pursuant to § 7 Para. 1 TMG. According to §§ 8 to 10 TMG, however, we
                are not obliged as a service provider to monitor transmitted or stored third-party
                information or to investigate circumstances that indicate illegal activity.
              </p>
              <p>
                Obligations to remove or block the use of information under general law remain
                unaffected. However, liability in this regard is only possible from the point in
                time at which we become aware of a specific legal infringement. Upon becoming aware
                of such infringements, we will remove this content immediately.
              </p>
            </section>

            <section>
              <h2>Liability for Links</h2>
              <p>
                Our website contains links to external websites of third parties over whose content
                we have no influence. Therefore, we cannot accept any liability for this third-party
                content. The respective provider or operator of the pages is always responsible for
                the content of the linked pages.
              </p>
              <p>
                The linked pages were checked for possible legal violations at the time of linking.
                Illegal content was not recognizable at the time of linking. However, permanent
                content control of the linked pages is not reasonable without concrete evidence of
                an infringement.
              </p>
            </section>

            <section>
              <h2>Copyright</h2>
              <p>
                The content and works created by the site operators on these pages are subject to
                German copyright law. Duplication, processing, distribution, and any form of
                commercialization of such material beyond the scope of copyright law require the
                prior written consent of the respective author or creator.
              </p>
              <p>
                Insofar as the content on this site was not created by the operator, the copyrights
                of third parties are respected. In particular, third-party content is identified as
                such. Should you become aware of a copyright infringement, please inform us
                accordingly. Upon becoming aware of infringements, we will remove such content
                immediately.
              </p>
            </section>
          </div>

          <div className="mt-12 rounded-2xl bg-amber-50 p-6 ring-1 ring-amber-200/60">
            <p className="text-sm font-bold text-amber-800">📝 Note for site operator</p>
            <p className="mt-1 text-sm leading-relaxed text-amber-700">
              Replace the placeholder fields (marked with brackets) with your actual legal
              information before publishing. German law requires a complete Impressum with your real
              name and address.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
