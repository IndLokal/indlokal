import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        // SEO: /stuttgart/telugu-communities → /stuttgart/communities?language=telugu
        source: '/:city/:language-communities',
        destination: '/:city/communities?language=:language',
      },
    ];
  },
};

export default nextConfig;
