import type { Metadata } from 'next';
import Link from 'next/link';
import { siteConfig } from '@/lib/config';

export const metadata: Metadata = {
  title: `Privacy Policy — ${siteConfig.name}`,
  description: `Privacy Policy for ${siteConfig.name}. Learn how we collect, use, and protect your data.`,
};

export default function PrivacyPolicyPage() {
  const lastUpdated = '17 April 2026';

  return (
    <>
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
          Privacy Policy
        </h1>
        <p className="text-muted mt-2 text-sm">Last updated: {lastUpdated}</p>

        <div className="prose-legal mt-10 space-y-8">
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
              <a href={siteConfig.url} className="text-brand-600 hover:underline">
                {siteConfig.url}
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
              Email: privacy@indlokal.de
            </p>
          </section>

          <section>
            <h2>3. Data We Collect</h2>
            <h3>3.1 Information you provide</h3>
            <ul>
              <li>
                <strong>Account data:</strong> When you sign in via Google OAuth, we receive your
                name, email address, and profile picture.
              </li>
              <li>
                <strong>Community submissions:</strong> Name, description, contact details, and
                other information you submit about communities.
              </li>
              <li>
                <strong>Contact forms:</strong> Any information you provide when contacting us.
              </li>
            </ul>

            <h3>3.2 Automatically collected data</h3>
            <ul>
              <li>
                <strong>Usage data:</strong> Pages visited, time spent, and interactions — collected
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
              <li>Authenticating user accounts (Google OAuth)</li>
              <li>Processing community submissions and claims</li>
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
                <strong>Authentication providers:</strong> Google (for OAuth sign-in) — subject to
                Google&apos;s Privacy Policy.
              </li>
              <li>
                <strong>Legal authorities:</strong> If required by law or to protect our rights.
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
                <strong>Data portability</strong> — receive your data in a structured format
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
              <a href="mailto:privacy@indlokal.de" className="text-brand-600 hover:underline">
                privacy@indlokal.de
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
              <a href="mailto:privacy@indlokal.de" className="text-brand-600 hover:underline">
                privacy@indlokal.de
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
