import type { NextConfig } from 'next';

const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Google OAuth avatars
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'lh4.googleusercontent.com' },
      { protocol: 'https', hostname: 'lh5.googleusercontent.com' },
      { protocol: 'https', hostname: 'lh6.googleusercontent.com' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://plausible.io https://eu.i.posthog.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob:",
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self' https://eu.i.posthog.com https://plausible.io https://accounts.google.com https://oauth2.googleapis.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      // PostHog reverse proxy — routes analytics through our domain to avoid ad-blockers
      {
        source: '/ingest/static/:path*',
        destination: `${POSTHOG_HOST}/static/:path*`,
      },
      {
        source: '/ingest/:path*',
        destination: `${POSTHOG_HOST}/:path*`,
      },
      {
        // SEO: /stuttgart/telugu-communities → /stuttgart/communities?language=telugu
        source: '/:city/:language-communities',
        destination: '/:city/communities?language=:language',
      },
      {
        // SEO: /stuttgart/professional-groups → /stuttgart/communities?category=professional
        source: '/:city/:category-groups',
        destination: '/:city/communities?category=:category',
      },
    ];
  },
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
