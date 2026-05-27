import type { Metadata } from 'next';
import { siteConfig } from '@/lib/config';
import { InfoPageHero } from '@/components/info/InfoPageHero';

export const metadata: Metadata = {
  title: `Terms of Service - ${siteConfig.name}`,
  description: `Terms of Service for ${siteConfig.name}.`,
  alternates: {
    canonical: '/terms',
  },
};

export default function TermsPage() {
  const lastUpdated = '27 May 2026';
  const legalUrl = siteConfig.url.includes('localhost') ? 'https://indlokal.com' : siteConfig.url;

  return (
    <>
      <InfoPageHero
        title="Terms of Service"
        description={`Review the terms for using ${siteConfig.name}.`}
        meta={`Last updated: ${lastUpdated}`}
      />

      <div className="mx-auto max-w-3xl px-4 py-12 sm:py-14">
        <div className="prose-legal mt-6 space-y-8 sm:mt-8">
          <section>
            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing or using {siteConfig.name} (the &quot;Service&quot;), available at{' '}
              <a href={legalUrl} className="text-brand-600 hover:underline">
                {legalUrl}
              </a>
              , you agree to be bound by these Terms of Service. If you do not agree, please do not
              use the Service.
            </p>
          </section>

          <section>
            <h2>2. Description of Service</h2>
            <p>
              {siteConfig.name} is a community discovery platform that aggregates information about
              Indian communities, events, and resources in German cities. The Service provides:
            </p>
            <ul>
              <li>A directory of Indian communities and cultural groups</li>
              <li>Event listings and calendar information</li>
              <li>Expat resources and practical guides</li>
              <li>Community submission and organizer tools</li>
            </ul>
          </section>

          <section>
            <h2>3. User Accounts</h2>
            <p>
              Some features require account access. User sign-in is currently available in the
              mobile app, while organizer and admin access on web uses email-based magic links. By
              creating an account, you agree to:
            </p>
            <ul>
              <li>Provide accurate information</li>
              <li>Maintain the security of your account</li>
              <li>Notify us immediately of any unauthorized access</li>
              <li>Accept responsibility for all activity under your account</li>
            </ul>
          </section>

          <section>
            <h2>4. Community Submissions</h2>
            <p>When submitting community information, you represent that:</p>
            <ul>
              <li>The information is accurate and not misleading</li>
              <li>You have the right to share the information provided</li>
              <li>The community is a legitimate organization or group</li>
              <li>Contact information is valid and belongs to an authorized representative</li>
            </ul>
            <p>
              We reserve the right to review, edit, or remove any submission that violates these
              terms or our content guidelines.
            </p>
          </section>

          <section>
            <h2>5. Organizer Accounts</h2>
            <p>Community organizers who claim a community page agree to:</p>
            <ul>
              <li>Verify their association with the community</li>
              <li>Keep community information up to date</li>
              <li>Not post misleading event information</li>
              <li>Respond to user inquiries in a timely manner</li>
            </ul>
          </section>

          <section>
            <h2>6. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul>
              <li>Use the Service for any unlawful purpose</li>
              <li>Post content that is hateful, discriminatory, or harassing</li>
              <li>Attempt to gain unauthorized access to the Service</li>
              <li>Scrape or collect data from the Service without permission</li>
              <li>Interfere with the Service&apos;s operation or other users&apos; access</li>
              <li>Impersonate another person or organization</li>
            </ul>
          </section>

          <section>
            <h2>7. Intellectual Property</h2>
            <p>
              The Service&apos;s design, code, and branding are the property of {siteConfig.name}.
              Community-submitted content remains the property of the respective communities. By
              submitting content, you grant us a non-exclusive license to display it on the
              platform.
            </p>
          </section>

          <section>
            <h2>8. Disclaimer</h2>
            <p>
              The Service is provided &quot;as is&quot; without warranties of any kind. We do not
              guarantee the accuracy or completeness of community or event information. We are not
              responsible for the actions or content of third-party communities listed on the
              platform.
            </p>
          </section>

          <section>
            <h2>9. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, {siteConfig.name} shall not be liable for any
              indirect, incidental, special, or consequential damages arising from the use of the
              Service. Our total liability shall not exceed the amount you have paid us (if any) in
              the 12 months prior to the claim.
            </p>
          </section>

          <section>
            <h2>10. Changes to Terms</h2>
            <p>
              We may update these Terms from time to time. Continued use of the Service after
              changes are posted constitutes acceptance. We will make reasonable efforts to notify
              users of significant changes.
            </p>
          </section>

          <section>
            <h2>11. Governing Law</h2>
            <p>
              These Terms are governed by the laws of the Federal Republic of Germany. Any disputes
              shall be subject to the exclusive jurisdiction of the courts in Stuttgart, Germany.
            </p>
          </section>

          <section>
            <h2>12. Contact</h2>
            <p>
              For questions about these Terms, contact us at{' '}
              <a href="mailto:legal@indlokal.com" className="text-brand-600 hover:underline">
                legal@indlokal.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
