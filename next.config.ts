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
      // Community logos (user-submitted URLs — allow any https)
      { protocol: 'https', hostname: '**' },
    ],
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
