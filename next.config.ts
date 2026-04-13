import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
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
};

export default nextConfig;
