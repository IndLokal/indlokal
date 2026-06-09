import type { Metadata } from 'next';
import { siteConfig } from '@/lib/config';
import { InfoPageHero } from '@/components/info/InfoPageHero';
import {
  PUBLIC_SITE_EMAILS,
  PUBLIC_SITE_LAST_REVIEWED,
  resolvePublicSiteUrl,
} from '@/lib/public-site-content';

export const metadata: Metadata = {
  title: `Privacy Policy - ${siteConfig.name}`,
  description: `Privacy Policy for ${siteConfig.name}. Learn how we collect, use, and protect your data.`,
  alternates: {
    canonical: '/privacy',
  },
};

export default function PrivacyPolicyPage() {
  const legalUrl = resolvePublicSiteUrl(siteConfig.url);

  return (
    <>
      <InfoPageHero
        title="Privacy Policy"
        description={`Learn how ${siteConfig.name} collects, uses, and protects your data.`}
        meta={`Last updated: ${PUBLIC_SITE_LAST_REVIEWED}`}
      />

      <div className="mx-auto max-w-3xl px-4 py-12 sm:py-14">
        <div className="prose-legal mt-6 space-y-8 sm:mt-8">
          <section>
            <h2>1. Introduction</h2>
            <p>
              Welcome to {siteConfig.name} (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;). We
              are committed to protecting your personal data and respecting your privacy in
              accordance with the General Data Protection Regulation (GDPR) and the German Federal
              Data Protection Act (BDSG).
            </p>
            <p>
              This Privacy Policy explains how we collect, use, store, and protect information when
              you use our website at{' '}
              <a href={legalUrl} className="text-brand-600 hover:underline">
                {legalUrl}
              </a>{' '}
              (the &quot;Service&quot;).
            </p>
          </section>

          <section>
            <h2>2. Data Controller</h2>
            <p>The data controller responsible for your personal data is: </p>
            <p>
              {siteConfig.name}
              <br />
              Germany
              <br />
              Email: {PUBLIC_SITE_EMAILS.privacy}
            </p>
          </section>

          <section>
            <h2>3. Data We Collect</h2>
            <h3>3.1 Information you provide</h3>
            <ul>
              <li>
                <strong>Account data:</strong> When sign-in is available (currently in the mobile
                app and for organizer/admin access on web), we process your name and email address.
              </li>
              <li>
                <strong>Community submissions:</strong> Name, description, contact details, and
                other information you submit about communities.
              </li>
              <li>
                <strong>Business Connect enquiries (JITO Stuttgart pilot):</strong> If you submit a
                business enquiry, we process the company and contact details you provide (including
                business description, what you are looking for and offering, contact name, email,
                and any optional website, LinkedIn, phone/WhatsApp, or referral details) to review
                your enquiry and, with your consent, to make a curated introduction.
              </li>
              <li>
                <strong>Contact forms:</strong> Any information you provide when contacting us.
              </li>
            </ul>

            <h3>3.2 Automatically collected data</h3>
            <ul>
              <li>
                <strong>Usage data:</strong> Pages visited, time spent, and interactions - collected
                via privacy-friendly analytics (Plausible Analytics). No cookies are used for
                analytics, and no personal data is collected.
              </li>
              <li>
                <strong>Technical data:</strong> Browser type, device type, and IP address
                (anonymized) for security and performance purposes.
              </li>
            </ul>
          </section>

          <section>
            <h2>4. How We Use Your Data</h2>
            <p>We process your data for the following purposes:</p>
            <ul>
              <li>Providing and maintaining the Service</li>
              <li>Authenticating user accounts</li>
              <li>Processing community submissions and claims</li>
              <li>
                Using submitted email addresses to follow up on submissions and claims (for example,
                verification, approval status, or required clarifications)
              </li>
              <li>
                Sending essential service communications, including organizer/admin magic-link login
                emails and security-related account notifications
              </li>
              <li>Communicating with you about the Service</li>
              <li>Improving the Service through aggregated, anonymized analytics</li>
              <li>Complying with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2>5. Legal Basis for Processing</h2>
            <p>Under the GDPR, we process your data based on:</p>
            <ul>
              <li>
                <strong>Consent (Art. 6(1)(a) GDPR):</strong> When you voluntarily sign in or submit
                information.
              </li>
              <li>
                <strong>Contractual necessity (Art. 6(1)(b) GDPR):</strong> To provide the Service
                you requested.
              </li>
              <li>
                <strong>Legitimate interest (Art. 6(1)(f) GDPR):</strong> To improve and secure our
                Service.
              </li>
            </ul>
          </section>

          <section>
            <h2>6. Data Sharing</h2>
            <p>We do not sell your personal data. We may share data with:</p>
            <ul>
              <li>
                <strong>Hosting providers:</strong> Our infrastructure is hosted on secure servers
                within the EU.
              </li>
              <li>
                <strong>Authentication providers:</strong> Social sign-in providers such as Google
                (where enabled) and our email delivery provider for magic-link sign-in.
              </li>
              <li>
                <strong>Legal authorities:</strong> If required by law or to protect our rights.
              </li>
              <li>
                <strong>Curated Business Connect introductions (JITO Stuttgart pilot):</strong>{' '}
                Selected information from a business enquiry is shared with a relevant matched party
                only after manual review, and only where you have given the separate optional
                consent for sharing. Enquiries are never publicly listed, sold, or used for
                automated matching.
              </li>
            </ul>
          </section>

          <section>
            <h2>7. Data Retention</h2>
            <p>
              We retain your personal data only as long as necessary for the purposes outlined
              above. Account data is retained while your account is active. You may request deletion
              at any time.
            </p>
          </section>

          <section>
            <h2>8. Your Rights</h2>
            <p>Under the GDPR, you have the right to:</p>
            <ul>
              <li>
                <strong>Access</strong> your personal data
              </li>
              <li>
                <strong>Rectify</strong> inaccurate data
              </li>
              <li>
                <strong>Erase</strong> your data (&quot;right to be forgotten&quot;)
              </li>
              <li>
                <strong>Restrict</strong> processing of your data
              </li>
              <li>
                <strong>Data portability</strong> - receive your data in a structured format
              </li>
              <li>
                <strong>Object</strong> to processing based on legitimate interest
              </li>
              <li>
                <strong>Withdraw consent</strong> at any time
              </li>
            </ul>
            <p>
              To exercise any of these rights, contact us at{' '}
              <a
                href={`mailto:${PUBLIC_SITE_EMAILS.privacy}`}
                className="text-brand-600 hover:underline"
              >
                {PUBLIC_SITE_EMAILS.privacy}
              </a>
              .
            </p>
          </section>

          <section>
            <h2>9. Cookies</h2>
            <p>
              We use only essential cookies required for the Service to function (e.g., session
              cookies for authentication). We do not use tracking cookies or third-party advertising
              cookies. Our analytics solution (Plausible) is cookie-free.
            </p>
          </section>

          <section>
            <h2>10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of significant
              changes by posting a notice on our website. Continued use of the Service after changes
              constitutes acceptance.
            </p>
          </section>

          <section>
            <h2>11. Contact</h2>
            <p>
              For privacy-related inquiries, contact us at:{' '}
              <a
                href={`mailto:${PUBLIC_SITE_EMAILS.privacy}`}
                className="text-brand-600 hover:underline"
              >
                {PUBLIC_SITE_EMAILS.privacy}
              </a>
            </p>
            <p>
              You also have the right to lodge a complaint with a supervisory authority, in
              particular in the EU member state of your habitual residence.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
