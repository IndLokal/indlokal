import type { Metadata } from 'next';
import { siteConfig } from '@/lib/config';
import { InfoPageHero } from '@/components/info/InfoPageHero';

export const metadata: Metadata = {
  title: `Impressum - ${siteConfig.name}`,
  description: `Legal notice (Impressum) for ${siteConfig.name} in accordance with German law (§ 5 DDG).`,
  alternates: {
    canonical: '/impressum',
  },
};

export default function ImpressumPage() {
  const lastReviewed = '27 May 2026';
  const legalUrl = siteConfig.url.includes('localhost') ? 'https://indlokal.com' : siteConfig.url;

  return (
    <>
      <InfoPageHero
        title="Impressum"
        description={`Legal notice (Impressum) for ${siteConfig.name} in accordance with German law (§ 5 DDG).`}
        meta={`Last reviewed: ${lastReviewed}`}
      />

      <div className="mx-auto max-w-3xl px-4 py-12 sm:py-14">
        <div className="prose-legal mt-6 space-y-8 sm:mt-8">
          <section>
            <h2>Information pursuant to § 5 DDG</h2>
            <p>
              {siteConfig.name}
              <br />
              Digital information platform for Indian communities and events in Germany.
            </p>
          </section>

          <section>
            <h2>Contact</h2>
            <p>
              Email:{' '}
              <a href="mailto:contact@indlokal.com" className="text-brand-600 hover:underline">
                contact@indlokal.com
              </a>
              <br />
              Website:{' '}
              <a href={legalUrl} className="text-brand-600 hover:underline">
                {legalUrl}
              </a>
            </p>
          </section>

          <section>
            <h2>Responsible for Editorial Content pursuant to § 18 Abs. 2 MStV</h2>
            <p>
              IndLokal Editorial Team
              <br />
              <a href="mailto:contact@indlokal.com" className="text-brand-600 hover:underline">
                contact@indlokal.com
              </a>
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
              We are not willing or obliged to participate in dispute resolution proceedings before
              a consumer arbitration board.
            </p>
          </section>

          <section>
            <h2>Liability for Content</h2>
            <p>
              As a service provider, we are responsible for our own content on these pages under
              general law. We are not obliged to monitor transmitted or stored third-party
              information unless statutory obligations apply.
            </p>
            <p>
              Obligations to remove or block the use of information under general law remain
              unaffected. However, liability in this regard is only possible from the point in time
              at which we become aware of a specific legal infringement. Upon becoming aware of such
              infringements, we will remove this content immediately.
            </p>
          </section>

          <section>
            <h2>Liability for Links</h2>
            <p>
              Our website contains links to external websites of third parties over whose content we
              have no influence. Therefore, we cannot accept any liability for this third-party
              content. The respective provider or operator of the pages is always responsible for
              the content of the linked pages.
            </p>
            <p>
              The linked pages were checked for possible legal violations at the time of linking.
              Illegal content was not recognizable at the time of linking. However, permanent
              content control of the linked pages is not reasonable without concrete evidence of an
              infringement.
            </p>
          </section>

          <section>
            <h2>Copyright</h2>
            <p>
              The content and works created by the site operators on these pages are subject to
              German copyright law. Duplication, processing, distribution, and any form of
              commercialization of such material beyond the scope of copyright law require the prior
              written consent of the respective author or creator.
            </p>
            <p>
              Insofar as the content on this site was not created by the operator, the copyrights of
              third parties are respected. In particular, third-party content is identified as such.
              Should you become aware of a copyright infringement, please inform us accordingly.
              Upon becoming aware of infringements, we will remove such content immediately.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
